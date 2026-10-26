import{c as e,f as t,h as n,i as r,n as i,t as a}from"./util-CcjZ4Agd.js";import{t as o}from"./check-BDXyK3Xn.js";import{t as s}from"./copy-DS4JRd4f.js";import{t as c}from"./download-DyJu-qb-.js";import{t as l}from"./trash-BLoDqSwE.js";import{C as u,D as d,E as f,H as p,M as m,N as h,T as g,U as _,W as v,et as y,it as b,k as x,n as S,nt as C,q as w,rt as T,tt as E,w as D,x as O}from"./index-DyvMmmbW.js";var k={name:`rotate-ccw-clock`,size:24,node:[[`path`,{d:`M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8`,key:`1357e3`}],[`path`,{d:`M3 3v5h5`,key:`1xhq8a`}],[`path`,{d:`M12 7v5l4 2`,key:`1fdv2h`}]],aliases:[`history`]};k.node;var A=y(k),j=n(t()),M=v(),N=[{id:`cover-note`,label:`Cover note`,tpl:`To,
The [officer and office]

Subject: [what you are asking for] for [property or certificate]

Sir/Madam,

[One or two lines: who you are and what you have.]

I enclose: [list of documents].

Please tell me [what you need to know].

Yours faithfully,
[Your name]
[Mobile]
[Date]
`},{id:`application-letter`,label:`Application letter`,tpl:`To,
The [authority]

Subject: Application for [service]

Sir/Madam,

I request [service] for [subject]. My details are:
- Name: [name]
- Address: [address]
- Reference or acknowledgement number (if any): [number]

Documents attached: [list]

Yours faithfully,
[Your name]
[Date]
`},{id:`escalation-letter`,label:`Escalation letter`,tpl:`To,
The [higher authority]

Subject: Delay or refusal on application [acknowledgement number]

Sir/Madam,

I applied for [service] on [date] (acknowledgement [number]). The stated time was [time as shown by the portal]. As of [date] the status is [status].

I request that you review the application and tell me the reason in writing.

Yours faithfully,
[Your name]
[Mobile]
`},{id:`checklist`,label:`Document checklist`,tpl:`# Document checklist

- [ ] [document 1]
- [ ] [document 2]
- [ ] Copies and originals as the official page asks

## Questions to ask the office
- [question]
`},{id:`meeting-notes`,label:`Visit or call notes`,tpl:`# Visit or call notes

Date: [date]
Office and person: [name]

## What I asked
[..]

## What they said
[..]

## Next step
[..]
`},{id:`explainer`,label:`Plain-language summary`,tpl:`# Summary

## What this is
[..]

## What I still need to confirm
[..]
`}],P=[{id:`brief`,label:`Brief`},{id:`draft`,label:`Draft`},{id:`edit`,label:`Edit`},{id:`approved`,label:`Approved`}];function F(){_(`Documents`);let{docs:e,cases:t,upsertDoc:n,prefs:r}=S(),i=C(),[o,s]=b(),[c,l]=(0,j.useState)(``),[p,v]=(0,j.useState)(`all`),[y,T]=(0,j.useState)(`all`),[D,k]=(0,j.useState)(`all`),[A,F]=(0,j.useState)(!!o.get(`new`)),[I,L]=(0,j.useState)(``),[R,z]=(0,j.useState)(`cover-note`),[B,V]=(0,j.useState)(``),[H,U]=(0,j.useState)(``),W=Array.from(new Set(e.flatMap(e=>e.tags))),G=(0,j.useMemo)(()=>e.filter(e=>(r.showDemo||!e.demo)&&(p===`all`||e.status===p)&&(y===`all`||e.type===y)&&(D===`all`||e.tags.includes(D))&&(!c.trim()||(e.title+e.body).toLowerCase().includes(c.trim().toLowerCase()))),[e,p,y,D,c,r.showDemo]);return(0,M.jsxs)(M.Fragment,{children:[(0,M.jsx)(h,{title:`Documents`,sub:`Draft letters, notes and checklists. Each moves through Brief, Draft, Edit and Approved, and keeps its versions.`,actions:(0,M.jsxs)(u,{variant:`primary`,onClick:()=>F(!0),children:[(0,M.jsx)(w,{size:16,"aria-hidden":!0}),`New document`]})}),(0,M.jsx)(m,{title:`Templates are plain fill-in text, not legal drafting`,children:(0,M.jsx)(`span`,{children:`Square brackets mark what you must fill in. Have an advocate review anything that matters.`})}),(0,M.jsxs)(`div`,{className:`grid sm:grid-cols-2 lg:grid-cols-4 gap-2 my-4`,children:[(0,M.jsxs)(`div`,{children:[(0,M.jsx)(`label`,{className:`sr-only`,htmlFor:`dq`,children:`Search`}),(0,M.jsx)(`input`,{id:`dq`,type:`search`,className:`input`,placeholder:`Search documents`,value:c,onChange:e=>l(e.target.value)})]}),(0,M.jsxs)(`div`,{children:[(0,M.jsx)(`label`,{className:`sr-only`,htmlFor:`ds`,children:`Status`}),(0,M.jsxs)(`select`,{id:`ds`,className:`select`,value:p,onChange:e=>v(e.target.value),children:[(0,M.jsx)(`option`,{value:`all`,children:`All statuses`}),P.map(e=>(0,M.jsx)(`option`,{value:e.id,children:e.label},e.id))]})]}),(0,M.jsxs)(`div`,{children:[(0,M.jsx)(`label`,{className:`sr-only`,htmlFor:`dt`,children:`Type`}),(0,M.jsxs)(`select`,{id:`dt`,className:`select`,value:y,onChange:e=>T(e.target.value),children:[(0,M.jsx)(`option`,{value:`all`,children:`All types`}),N.map(e=>(0,M.jsx)(`option`,{value:e.id,children:e.label},e.id))]})]}),(0,M.jsxs)(`div`,{children:[(0,M.jsx)(`label`,{className:`sr-only`,htmlFor:`dg`,children:`Tag`}),(0,M.jsxs)(`select`,{id:`dg`,className:`select`,value:D,onChange:e=>k(e.target.value),children:[(0,M.jsx)(`option`,{value:`all`,children:`All tags`}),W.map(e=>(0,M.jsx)(`option`,{children:e},e))]})]})]}),e.length===0?(0,M.jsx)(d,{title:`Your library is empty`,body:`Start from a template such as a cover note to the ward office.`,action:(0,M.jsx)(u,{variant:`primary`,onClick:()=>F(!0),children:`New document`})}):G.length===0?(0,M.jsx)(d,{title:`No documents match`,body:`Clear the search or filters.`,action:(0,M.jsx)(u,{onClick:()=>{l(``),v(`all`),T(`all`),k(`all`)},children:`Clear`})}):(0,M.jsx)(`ul`,{className:`m-0 p-0 list-none panel divide-y divide-line`,children:G.map(e=>(0,M.jsx)(`li`,{children:(0,M.jsxs)(E,{to:`/app/studio/${e.id}`,className:`flex flex-wrap items-center gap-2 p-4 no-underline text-ink hover:bg-soft`,children:[(0,M.jsxs)(`span`,{className:`flex-1 min-w-0`,children:[(0,M.jsx)(`b`,{children:e.title}),e.demo&&(0,M.jsx)(g,{}),(0,M.jsxs)(`span`,{className:`block text-[13px] text-mut`,children:[N.find(t=>t.id===e.type)?.label,e.caseId&&t.find(t=>t.id===e.caseId)?` - ${t.find(t=>t.id===e.caseId).title}`:``,` - `,a(e.updatedAt)]})]}),e.tags.map(e=>(0,M.jsx)(O,{children:e},e)),(0,M.jsx)(O,{tone:e.status===`approved`?`ok`:`accent`,children:P.find(t=>t.id===e.status)?.label})]})},e.id))}),(0,M.jsx)(f,{open:A,onClose:()=>{F(!1),s({},{replace:!0})},title:`New document`,footer:(0,M.jsxs)(M.Fragment,{children:[(0,M.jsx)(u,{onClick:()=>F(!1),children:`Cancel`}),(0,M.jsx)(u,{variant:`primary`,onClick:()=>{if(!I.trim()){U(`Enter a title.`);return}let e=n({title:I.trim(),type:R,caseId:B||void 0,body:N.find(e=>e.id===R).tpl,status:`brief`});F(!1),s({},{replace:!0}),i(`/app/studio/${e}`)},children:`Create`})]}),children:(0,M.jsxs)(`div`,{className:`grid gap-3`,children:[(0,M.jsx)(x,{label:`Title`,error:H,htmlFor:`nt`,children:(0,M.jsx)(`input`,{id:`nt`,className:`input`,value:I,onChange:e=>{L(e.target.value),U(``)},"aria-invalid":!!H})}),(0,M.jsx)(x,{label:`Type`,htmlFor:`nty`,children:(0,M.jsx)(`select`,{id:`nty`,className:`select`,value:R,onChange:e=>z(e.target.value),children:N.map(e=>(0,M.jsx)(`option`,{value:e.id,children:e.label},e.id))})}),(0,M.jsx)(x,{label:`Link to a case (optional)`,htmlFor:`nc`,children:(0,M.jsxs)(`select`,{id:`nc`,className:`select`,value:B,onChange:e=>V(e.target.value),children:[(0,M.jsx)(`option`,{value:``,children:`No case`}),t.filter(e=>!e.archived).map(e=>(0,M.jsx)(`option`,{value:e.id,children:e.title},e.id))]})})]})})]})}function I(){let{id:t}=T(),n=C(),m=S(e=>e.docs.find(e=>e.id===t)),v=S(e=>e.cases),y=S(e=>e.upsertDoc),b=S(e=>e.deleteDoc);_(m?.title??`Document`);let[w,O]=(0,j.useState)(m?.body??``),[k,F]=(0,j.useState)(m?.title??``),[I,L]=(0,j.useState)(!0),[R,z]=(0,j.useState)(!1),[B,V]=(0,j.useState)(!1),[H,U]=(0,j.useState)(``),W=(0,j.useRef)(void 0);if((0,j.useEffect)(()=>{O(m?.body??``),F(m?.title??``),L(!0)},[t]),(0,j.useEffect)(()=>()=>{W.current&&clearTimeout(W.current)},[]),!m)return(0,M.jsx)(d,{title:`Document not found`,body:`It may have been deleted.`,action:(0,M.jsx)(E,{className:`btn btn-primary`,to:`/app/studio`,children:`Back to documents`})});let G=(e,t)=>{L(!1),W.current&&clearTimeout(W.current),W.current=setTimeout(()=>{y({id:m.id,title:t.trim()||`Untitled`,body:e}),L(!0)},700)},K=()=>{W.current&&clearTimeout(W.current),y({id:m.id,title:k.trim()||`Untitled`,body:w},`Saved version`),L(!0),p(`Saved. Version added to history`)},q=w.split(`
`).filter(e=>/^#{1,3} /.test(e)||/^Subject:/.test(e)),J=`${k}\n\n${w}`,Y=P.findIndex(e=>e.id===m.status);return(0,M.jsxs)(M.Fragment,{children:[(0,M.jsx)(h,{crumbs:[{to:`/app/studio`,label:`Documents`},{label:m.title}],title:m.title,actions:(0,M.jsxs)(M.Fragment,{children:[m.demo&&(0,M.jsx)(g,{}),(0,M.jsxs)(u,{onClick:async()=>p(await i(w)?`Copied`:`Copy failed`,`info`),children:[(0,M.jsx)(s,{size:14,"aria-hidden":!0}),`Copy`]}),(0,M.jsxs)(u,{onClick:()=>{r(`${e(k)}.md`,J),p(`Downloaded .md`)},children:[(0,M.jsx)(c,{size:14,"aria-hidden":!0}),`.md`]}),(0,M.jsx)(u,{onClick:()=>{r(`${e(k)}.txt`,J,`text/plain`),p(`Downloaded .txt`)},children:`.txt`})]})}),(0,M.jsx)(`ol`,{className:`m-0 p-0 list-none flex flex-wrap gap-2 mb-4`,"aria-label":`Workflow`,children:P.map((e,t)=>(0,M.jsx)(`li`,{children:(0,M.jsxs)(`button`,{className:`btn btn-sm ${t===Y?`btn-primary`:``}`,"aria-current":t===Y?`step`:void 0,onClick:()=>{y({id:m.id,title:m.title,status:e.id}),p(`Moved to ${e.label}`)},children:[t<Y&&(0,M.jsx)(o,{size:12,"aria-hidden":!0}),t+1,`. `,e.label]})},e.id))}),(0,M.jsxs)(`div`,{className:`grid lg:grid-cols-[1fr_16rem] gap-6`,children:[(0,M.jsxs)(`div`,{className:`grid gap-3`,children:[(0,M.jsx)(x,{label:`Title`,htmlFor:`dti`,children:(0,M.jsx)(`input`,{id:`dti`,className:`input`,value:k,onChange:e=>{F(e.target.value),G(w,e.target.value)}})}),(0,M.jsx)(x,{label:`Body`,htmlFor:`dbo`,children:(0,M.jsx)(`textarea`,{id:`dbo`,className:`textarea font-mono text-[14px]`,rows:20,value:w,onChange:e=>{O(e.target.value),G(e.target.value,k)}})}),(0,M.jsxs)(`div`,{className:`flex flex-wrap items-center gap-2 justify-between`,children:[(0,M.jsx)(`span`,{className:`text-[13px] text-mut`,role:`status`,children:I?`All changes saved in this browser`:`Saving...`}),(0,M.jsxs)(`div`,{className:`flex gap-2`,children:[(0,M.jsxs)(u,{onClick:()=>z(!0),children:[(0,M.jsx)(A,{size:14,"aria-hidden":!0}),`History (`,m.versions.length,`)`]}),(0,M.jsx)(u,{variant:`primary`,onClick:K,children:`Save version`})]})]})]}),(0,M.jsxs)(`aside`,{className:`grid gap-4 content-start text-[14px]`,children:[(0,M.jsxs)(`section`,{className:`panel p-3`,children:[(0,M.jsx)(`h2`,{className:`text-[13px] font-semibold mb-1`,children:`Details`}),(0,M.jsx)(`p`,{className:`m-0 text-mut`,children:N.find(e=>e.id===m.type)?.label}),(0,M.jsx)(`label`,{className:`label mt-2`,htmlFor:`dcase`,children:`Linked case`}),(0,M.jsxs)(`select`,{id:`dcase`,className:`select`,value:m.caseId??``,onChange:e=>y({id:m.id,title:m.title,caseId:e.target.value||void 0}),children:[(0,M.jsx)(`option`,{value:``,children:`None`}),v.map(e=>(0,M.jsx)(`option`,{value:e.id,children:e.title},e.id))]})]}),(0,M.jsxs)(`section`,{className:`panel p-3`,children:[(0,M.jsx)(`h2`,{className:`text-[13px] font-semibold mb-1`,children:`Tags`}),(0,M.jsxs)(`div`,{className:`flex flex-wrap gap-1 mb-2`,children:[m.tags.map(e=>(0,M.jsxs)(`button`,{className:`badge cursor-pointer border-0`,"aria-label":`Remove tag ${e}`,onClick:()=>y({id:m.id,title:m.title,tags:m.tags.filter(t=>t!==e)}),children:[e,` x`]},e)),m.tags.length===0&&(0,M.jsx)(`span`,{className:`text-mut`,children:`No tags`})]}),(0,M.jsxs)(`form`,{className:`flex gap-1`,onSubmit:e=>{e.preventDefault();let t=H.trim().toLowerCase();t&&!m.tags.includes(t)&&y({id:m.id,title:m.title,tags:[...m.tags,t]}),U(``)},children:[(0,M.jsx)(`label`,{className:`sr-only`,htmlFor:`tg`,children:`Add tag`}),(0,M.jsx)(`input`,{id:`tg`,className:`input !min-h-8`,placeholder:`Add tag`,value:H,onChange:e=>U(e.target.value)}),(0,M.jsx)(`button`,{className:`btn btn-sm`,type:`submit`,children:`Add`})]})]}),(0,M.jsxs)(`section`,{className:`panel p-3`,children:[(0,M.jsx)(`h2`,{className:`text-[13px] font-semibold mb-1`,children:`Outline`}),q.length===0?(0,M.jsx)(`p`,{className:`m-0 text-mut`,children:`Headings starting with # or a Subject line appear here.`}):(0,M.jsx)(`ul`,{className:`m-0 pl-4`,children:q.map((e,t)=>(0,M.jsx)(`li`,{children:e.replace(/^#+ /,``)},t))})]}),(0,M.jsxs)(u,{variant:`ghost`,className:`text-bad`,onClick:()=>V(!0),children:[(0,M.jsx)(l,{size:14,"aria-hidden":!0}),`Delete document`]})]})]}),(0,M.jsx)(f,{open:R,onClose:()=>z(!1),title:`Version history`,wide:!0,children:m.versions.length===0?(0,M.jsx)(`p`,{className:`m-0 text-mut`,children:`No earlier versions yet. A version is stored whenever the text changes.`}):(0,M.jsx)(`ul`,{className:`m-0 p-0 list-none grid gap-2 max-h-96 overflow-auto`,children:m.versions.map((e,t)=>(0,M.jsxs)(`li`,{className:`panel p-3`,children:[(0,M.jsxs)(`div`,{className:`flex justify-between gap-2 items-center`,children:[(0,M.jsxs)(`span`,{className:`text-[13px] text-mut`,children:[a(e.at),` - `,e.note]}),(0,M.jsx)(u,{size:`sm`,onClick:()=>{O(e.body),y({id:m.id,title:m.title,body:e.body},`Before restore`),z(!1),p(`Version restored`)},children:`Restore`})]}),(0,M.jsx)(`pre`,{className:`m-0 mt-2 whitespace-pre-wrap text-[12px] max-h-24 overflow-hidden`,children:e.body.slice(0,300)})]},t))})}),(0,M.jsx)(D,{open:B,onClose:()=>V(!1),title:`Delete this document?`,body:`The text and all its versions are removed from this browser. This cannot be undone.`,onConfirm:()=>{b(m.id),p(`Document deleted`),n(`/app/studio`)}})]})}export{I as StudioEditor,F as StudioList,N as TYPES};