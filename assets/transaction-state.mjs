/* Provider-neutral state validation. Not a gateway, availability provider or payment processor. */
export const TRANSITIONS=Object.freeze({DRAFT:['AVAILABILITY_VERIFIED','CANCELLED'],AVAILABILITY_VERIFIED:['PAYMENT_PENDING','CANCELLED'],PAYMENT_PENDING:['PAID','PAYMENT_FAILED','CANCELLED'],PAYMENT_FAILED:['PAYMENT_PENDING','CANCELLED'],PAID:['CONFIRMED','REFUND_PENDING'],CONFIRMED:['CHECKED_IN','REFUND_PENDING'],CHECKED_IN:['COMPLETED'],REFUND_PENDING:['REFUNDED','REFUND_FAILED'],REFUND_FAILED:['REFUND_PENDING'],COMPLETED:[],REFUNDED:[],CANCELLED:[]});
export function nextTransaction(current,event){
 if(!current||!event||!current.id||!event.id||!event.target)throw Error('Missing identity');
 if((current.processedEvents||[]).includes(event.id))return {...current,duplicate:true};
 if(!TRANSITIONS[current.status]?.includes(event.target))throw Error('Invalid transition');
 if(!Number.isSafeInteger(current.amountMinor)||current.amountMinor<0||!current.currency)throw Error('Invalid total');
 if(['PAID','REFUNDED'].includes(event.target)){
  if(event.providerVerified!==true||!event.providerReference)throw Error('Verified provider event required');
  if(event.amountMinor!==current.amountMinor||event.currency!==current.currency)throw Error('Amount or currency mismatch');
 }
 if(event.target==='AVAILABILITY_VERIFIED'&&!(event.availabilityVerified===true&&event.holdReference&&event.termsVersion))throw Error('Verified availability and terms required');
 if(event.target==='CONFIRMED'&&!(event.reservationVerified===true&&event.reservationReference))throw Error('Merchant reservation confirmation required');
 return {...current,status:event.target,processedEvents:[...(current.processedEvents||[]),event.id],lastEventId:event.id,duplicate:false};
}
