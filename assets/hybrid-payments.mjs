/* Pure ledger calculations. No provider, network, settlement, invoice issuance or secret handling. */
export const PAYMENT_STATUSES=Object.freeze(['CREATED','PENDING','AUTHORIZED','SUCCESSFUL','FAILED','CANCELLED','REFUNDED','PARTIALLY_REFUNDED','DISPUTED','SETTLEMENT_PENDING','SETTLED']);
const minor=n=>{if(!Number.isSafeInteger(n)||n<0)throw Error('Use nonnegative integer minor units');return n};
export function selectCommissionRule(order,rules,now=Date.now()){
 const eligible=rules.filter(r=>r.status==='APPROVED'&&r.agreementId&&r.effectiveAt<=now&&r.expiresAt>now&&(!r.vertical||r.vertical===order.vertical)&&(!r.subcategory||r.subcategory===order.subcategory)&&(!r.merchantId||r.merchantId===order.merchantId)&&(!r.bookingType||r.bookingType===order.bookingType)&&order.grossMinor>=(r.minGrossMinor||0)&&(r.maxGrossMinor==null||order.grossMinor<=r.maxGrossMinor));
 if(!eligible.length)throw Error('No approved commission agreement');
 eligible.sort((a,b)=>(b.priority||0)-(a.priority||0));if(eligible.length>1&&(eligible[0].priority||0)===(eligible[1].priority||0))throw Error('Ambiguous commission rules');
 const r=eligible[0];if(!Number.isInteger(r.rateBps)||r.rateBps<0||r.rateBps>10000)throw Error('Invalid commission rate');return r;
}
export function calculateAllocation(order,rule){
 const gross=minor(order.grossMinor),fee=minor(order.gatewayFeeMinor),gatewayTax=minor(order.gatewayTaxMinor),commissionTax=minor(order.commissionTaxMinor||0);
 if(!['marketplace','direct'].includes(order.paymentModel)||!order.merchantId||!order.bookingId||!order.id||!order.currency)throw Error('Missing payment context');
 if(!rule.agreementId||!Number.isInteger(rule.rateBps)||rule.rateBps<0||rule.rateBps>10000)throw Error('Invalid commission agreement');
 // Commission basis is explicit in the signed agreement; never assume taxes are included.
 const basis=minor(order.commissionBasisMinor);if(basis>gross)throw Error('Commission basis exceeds payment');
 const commission=Number((BigInt(basis)*BigInt(rule.rateBps)+5000n)/10000n);
 const merchantNet=gross-commission-commissionTax-fee-gatewayTax;if(merchantNet<0)throw Error('Deductions exceed gross');
 return {orderId:order.id,bookingId:order.bookingId,merchantId:order.merchantId,paymentModel:order.paymentModel,currency:order.currency,grossMinor:gross,commissionBasisMinor:basis,commissionRateBps:rule.rateBps,commissionMinor:commission,commissionTaxMinor:commissionTax,gatewayFeeMinor:fee,gatewayTaxMinor:gatewayTax,merchantNetMinor:merchantNet,agreementId:rule.agreementId,ruleId:rule.id,commissionReceivableMinor:order.paymentModel==='direct'?commission+commissionTax:0,automaticSplit:order.paymentModel==='marketplace'};
}
const transitions={CREATED:['PENDING','CANCELLED'],PENDING:['AUTHORIZED','SUCCESSFUL','FAILED','CANCELLED'],AUTHORIZED:['SUCCESSFUL','FAILED','CANCELLED'],SUCCESSFUL:['PARTIALLY_REFUNDED','REFUNDED','DISPUTED','SETTLEMENT_PENDING'],PARTIALLY_REFUNDED:['PARTIALLY_REFUNDED','REFUNDED','DISPUTED'],SETTLEMENT_PENDING:['SETTLED','PARTIALLY_REFUNDED','REFUNDED','DISPUTED'],SETTLED:['PARTIALLY_REFUNDED','REFUNDED','DISPUTED'],DISPUTED:['SUCCESSFUL','REFUNDED'],FAILED:[],CANCELLED:[],REFUNDED:[]};
export function applyPaymentEvent(payment,event){
 if(!payment.id||event.paymentId!==payment.id||!event.id)throw Error('Wrong event identity');
 if((payment.eventIds||[]).includes(event.id))return {...payment,duplicate:true};
 // Only the server adapter may set this after authenticating the provider and reconciling its response.
 if(event.serverVerified!==true||!event.providerReference||!event.provider)throw Error('Server-verified provider evidence required');
 if(event.currency!==payment.currency||event.amountMinor!==payment.grossMinor)throw Error('Payment amount/currency mismatch');
 if(!transitions[payment.status]?.includes(event.status))throw Error('Invalid payment transition');
 if(['PARTIALLY_REFUNDED','REFUNDED'].includes(event.status)){minor(event.refundedMinor);if(event.refundedMinor<=(payment.refundedMinor||0)||event.refundedMinor>payment.grossMinor)throw Error('Invalid cumulative refund');if(event.status==='REFUNDED'&&event.refundedMinor!==payment.grossMinor)throw Error('Full refund total required');if(event.status==='PARTIALLY_REFUNDED'&&event.refundedMinor===payment.grossMinor)throw Error('Use REFUNDED for full refund')}
 return {...payment,status:event.status,provider:event.provider,providerReference:event.providerReference,refundedMinor:event.refundedMinor??payment.refundedMinor??0,eventIds:[...(payment.eventIds||[]),event.id],duplicate:false};
}
export function commissionReversal(allocation,cumulativeRefundMinor){minor(cumulativeRefundMinor);if(cumulativeRefundMinor>allocation.grossMinor||allocation.grossMinor<=0)throw Error('Invalid refund basis');return Number((BigInt(allocation.commissionMinor)*BigInt(cumulativeRefundMinor)+BigInt(Math.floor(allocation.grossMinor/2)))/BigInt(allocation.grossMinor))}
