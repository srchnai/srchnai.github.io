/* Pure eligibility evaluation. Does not fetch, persist, publish or spend. Missing evidence always fails. */
export const DEFAULT_RULES=Object.freeze({minRating:4.2,minReviews:100});
export function evaluateListing(record,rules=DEFAULT_RULES,now=Date.now()){
 const reasons=[];const fresh=e=>e&&e.status==='VERIFIED'&&Number.isFinite(e.verifiedAt)&&Number.isFinite(e.expiresAt)&&e.verifiedAt<=now&&e.expiresAt>now;
 const g=record.googleEvidence,b=record.bookingEvidence,p=record.paymentEvidence,v=record.destinationEvidence;
 if(!(fresh(g)&&g.source==='GOOGLE_PLACES'&&typeof g.rating==='number'&&g.rating>=rules.minRating&&g.rating<=5&&Number.isInteger(g.reviewCount)&&g.reviewCount>=rules.minReviews&&g.placeId&&g.sourceUrl))reasons.push('RATING_UNVERIFIED');
 if(!(fresh(b)&&b.provider&&b.url&&/^https:\/\//.test(b.url)&&b.type&&b.availabilitySource&&b.terms))reasons.push('BOOKING_UNVERIFIED');
 if(record.vertical==='dine-in'&&!(b?.type==='TABLE_RESERVATION'&&record.businessType==='RESTAURANT'))reasons.push('DINE_IN_REQUIRES_RESTAURANT_TABLES');
 if(!(fresh(v)&&typeof v.lat==='number'&&Number.isFinite(v.lat)&&Math.abs(v.lat)<=90&&typeof v.lon==='number'&&Number.isFinite(v.lon)&&Math.abs(v.lon)<=180&&v.address))reasons.push('DESTINATION_UNVERIFIED');
 if(!(fresh(p)&&p.gatewayStatus==='ACTIVE'&&p.merchantStatus==='VERIFIED'&&p.receiptVerified===true&&p.refundTerms&&p.checkoutStatus==='TESTED'))reasons.push('PAYMENT_UNVERIFIED');
 if(record.suspended===true)reasons.push('SUSPENDED');
 return {eligible:reasons.length===0,status:record.suspended?'SUSPENDED':reasons.length?'DISCOVERED':'ELIGIBLE_FOR_REVIEW',reasons};
}
