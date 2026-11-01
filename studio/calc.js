/* SRCHN preview calculations. Pure functions, no network. All rates are PROPOSALS set by the user's brief, not approved terms. */
export const PROPOSED={successFeePct:30,creatorSharePct:25,cashbackPct:10,subscriptionBrandMonthly:1000,subscriptionBrandThreeYear:30000,creatorMonthly:500};
const r2=x=>Math.round((x+Number.EPSILON)*100)/100;
export function validate(i){const errs=[];for(const [k,l] of [['invoice','Invoice'],['feePct','Success fee %'],['refundPct','Refund %'],['taxPct','Tax %'],['sharePct','Creator share %'],['cashPct','Cashback %'],['procPct','Processing %'],['opCost','Operating cost'],['discount','Discount']]){const v=i[k];if(v===undefined||v==='')continue;const n=Number(v);if(!Number.isFinite(n))errs.push(l+' is not a number');else if(n<0)errs.push(l+' cannot be negative');else if(k.endsWith('Pct')&&n>100)errs.push(l+' cannot exceed 100');}return errs}
export function split(amount,shares){ // shares: percentages that must total 100; rounding remainder goes to the first creator so the parts sum exactly
 if(!shares||!shares.length)return [];const tot=shares.reduce((a,b)=>a+b,0);if(Math.abs(tot-100)>1e-9)throw new Error('attribution shares must total 100');
 const parts=shares.map(s=>r2(amount*s/100));const diff=r2(amount-parts.reduce((a,b)=>a+b,0));parts[0]=r2(parts[0]+diff);return parts}
export function economics(i){
 const errs=validate(i);const n=k=>Math.max(0,Number(i[k])||0),cl=k=>Math.min(100,n(k));
 const invoice=n('invoice'),feePct=cl('feePct'),refundPct=cl('refundPct'),taxPct=cl('taxPct'),sharePct=cl('sharePct'),cashPct=cl('cashPct'),procPct=cl('procPct'),opCost=n('opCost');
 const taxMode=i.taxMode==='exclusive'?'exclusive':'inclusive';
 const eligibleInvoice=r2(invoice*(1-refundPct/100));               // refunds and reversals reduce the eligible invoice
 const feeBase=r2(eligibleInvoice*feePct/100);                      // success fee before tax when exclusive
 const taxOnFee=taxMode==='inclusive'?r2(feeBase*taxPct/(100+taxPct)):r2(feeBase*taxPct/100);
 const feeCollected=taxMode==='inclusive'?feeBase:r2(feeBase+taxOnFee);   // exclusive: tax is added on top and collected for government
 const netFee=r2(feeCollected-taxOnFee);                           // SRCHN fee net of GST/indirect tax; never the brand invoice
 const cashBase=i.cashBase==='gross'?eligibleInvoice:netFee;        // explicit, user-selectable base (UNAPPROVED)
 const cashback=r2(cashBase*cashPct/100);
 const processing=r2(feeCollected*procPct/100);
 const discount=r2(n('discount'));
 const netProfit=r2(netFee-cashback-discount-processing-opCost);    // realised SRCHN net profit for this order after authorised deductions
 const commissionable=Math.max(0,netProfit);                        // creator share base = realised net profit, floored at zero
 const commission=r2(commissionable*sharePct/100);
 const contribution=r2(netProfit-commission);                       // what SRCHN keeps after the creator share
 return {errs,eligibleInvoice,feeCollected,taxOnFee,netFee,netProfit,discount,commissionable,commission,cashback,cashBaseAmount:r2(cashBase),processing,opCost:r2(opCost),contribution,negative:netProfit<0};
}
export function contentScore(a,w={completeness:25,quality:20,relevance:15,captions:15,accuracy:15,readiness:10}){
 // a: each criterion is a list of booleans (checks passed). Points = weight * passed/total.
 const out=[];let total=0;
 for(const k of Object.keys(w)){const c=a[k]||[];const p=c.length?w[k]*c.filter(x=>x.ok).length/c.length:0;total+=p;out.push({k,weight:w[k],points:r2(p),lost:c.filter(x=>!x.ok).map(x=>x.t)});}
 return {total:Math.round(total),parts:out};
}
export function hashtags({category,locality,subject,objective}){
 const clean=s=>(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9 ]/g,'').split(/\s+/).filter(Boolean).map((w,i)=>i?w[0].toUpperCase()+w.slice(1):w).join('');
 const t=['SRCHN','Bengaluru',clean(locality),clean(category),clean(subject),clean(objective)].filter(Boolean);
 return [...new Set(t.map(x=>'#'+x[0].toUpperCase()+x.slice(1)))].slice(0,6);
}
