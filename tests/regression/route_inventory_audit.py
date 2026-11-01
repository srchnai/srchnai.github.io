import re,json,csv,time,collections,urllib.parse
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor,as_completed
import requests
from bs4 import BeautifulSoup
BASE='https://srchn.in'
ROOT=Path('/tmp/srchnai.github.io')
UA={'User-Agent':'Mozilla/5.0 (compatible; SRCHN-master-QA/1.0)'}
# source route inventory
source_routes={}
for p in ROOT.rglob('*.html'):
    rel=p.relative_to(ROOT)
    if rel.name=='index.html': route='/' if len(rel.parts)==1 else '/'+'/'.join(rel.parts[:-1])+'/'
    else: route='/'+'/'.join(rel.parts)
    source_routes[route]=str(rel)
# sitemap
sitemap=requests.get(BASE+'/sitemap.xml',headers=UA,timeout=30).text
sitemap_urls=re.findall(r'<loc>(.*?)</loc>',sitemap)
sitemap_paths=[urllib.parse.urlparse(u).path + (('?'+urllib.parse.urlparse(u).query) if urllib.parse.urlparse(u).query else '') for u in sitemap_urls]
# known subcategory matrix
subcat_paths=[x.strip() for x in open('/tmp/all-illustrative-production-urls.txt') if x.strip()]
# static html internal hrefs
html_links=collections.defaultdict(set); external_links=collections.defaultdict(set); asset_refs=set()
for route,file in source_routes.items():
    text=(ROOT/file).read_text(errors='replace')
    soup=BeautifulSoup(text,'html.parser')
    for tag,attr in [('a','href'),('link','href'),('script','src'),('img','src'),('source','src'),('video','src')]:
        for x in soup.find_all(tag):
            v=x.get(attr)
            if not v or v.startswith(('#','mailto:','tel:','javascript:','data:')): continue
            u=urllib.parse.urljoin(BASE+route,v)
            pr=urllib.parse.urlparse(u)
            if pr.netloc=='srchn.in':
                path=pr.path+(('?'+pr.query) if pr.query else '')
                if re.search(r'\.(css|js|png|jpe?g|svg|webp|avif|woff2?|json|webmanifest|md|mp4|webm|pdf|zip)$',pr.path,re.I): asset_refs.add(path)
                elif tag=='a': html_links[route].add(path)
            else:
                if tag=='a': external_links[route].add(u)
# all page candidates
candidates=set(source_routes)|set(sitemap_paths)|set(subcat_paths)
for links in html_links.values():
    for link in links:
        pr=urllib.parse.urlparse(link)
        if not pr.query:
            candidates.add(link)
        elif pr.path == '/place/':
            candidates.add('/place/?o=n1614268619')
        elif pr.path == '/discovery/':
            candidates.add(link)
        else:
            candidates.add(pr.path)
# normalize hashless and strip download flags
candidates={x.split('#')[0] for x in candidates if x and not x.startswith('/assets/') and not x.startswith('/ph/') and not x.startswith('/photos/')}
# remove obvious non-page files
candidates={x for x in candidates if not re.search(r'\.(css|js|png|jpe?g|svg|webp|avif|woff2?|json|webmanifest|md|mp4|webm|pdf|zip)$',urllib.parse.urlparse(x).path,re.I)}
# assets from candidates
assets=set(asset_refs)
def fetch(path):
    url=urllib.parse.urljoin(BASE,path)
    try:
        r=requests.get(url,headers=UA,timeout=12,allow_redirects=True)
        ctype=r.headers.get('content-type','')
        item={'url':path,'status':r.status_code,'final_url':r.url,'content_type':ctype,'bytes':len(r.content),'title':'','description':'','canonical':'','h1':'','h1_count':0,'links':0,'buttons':0,'forms':0,'videos':0,'images':0,'images_missing_alt':0,'error':''}
        if 'text/html' in ctype:
            soup=BeautifulSoup(r.text,'html.parser')
            item['title']=soup.title.string.strip() if soup.title and soup.title.string else ''
            m=soup.find('meta',attrs={'name':'description'}); item['description']=m.get('content','').strip() if m else ''
            c=soup.find('link',rel='canonical'); item['canonical']=c.get('href','').strip() if c else ''
            hs=soup.find_all('h1'); item['h1_count']=len(hs); item['h1']=hs[0].get_text(' ',strip=True) if hs else ''
            item['links']=len(soup.find_all('a')); item['buttons']=len(soup.find_all('button')); item['forms']=len(soup.find_all('form')); item['videos']=len(soup.find_all('video')); imgs=soup.find_all('img'); item['images']=len(imgs); item['images_missing_alt']=sum(1 for i in imgs if not i.has_attr('alt'))
        return item
    except Exception as e:
        return {'url':path,'status':0,'final_url':url,'content_type':'','bytes':0,'title':'','description':'','canonical':'','h1':'','h1_count':0,'links':0,'buttons':0,'forms':0,'videos':0,'images':0,'images_missing_alt':0,'error':repr(e)[:300]}
def fetch_asset(path):
    url=urllib.parse.urljoin(BASE,path)
    try:
        r=requests.get(url,headers=UA,timeout=10,allow_redirects=True,stream=True)
        # only sample tiny prefix; content-length enough
        r.close()
        return {'url':path,'status':r.status_code,'final_url':r.url,'content_type':r.headers.get('content-type',''),'bytes':int(r.headers.get('content-length') or 0),'error':''}
    except Exception as e:return {'url':path,'status':0,'final_url':url,'content_type':'','bytes':0,'error':repr(e)[:300]}
paths=sorted(candidates); assets=sorted(assets)
print('page candidates', flush=True) if False else print('page candidates',len(paths),'assets',len(assets),'source routes',len(source_routes),'sitemap',len(sitemap_paths),'subcats',len(subcat_paths),'static link sources',len(html_links))
with ThreadPoolExecutor(max_workers=40) as ex:
    page_results=list(ex.map(fetch,paths))
with ThreadPoolExecutor(max_workers=40) as ex:
    asset_results=list(ex.map(fetch_asset,assets))
# duplicate metadata
title_groups=collections.defaultdict(list);desc_groups=collections.defaultdict(list)
for r in page_results:
    if r['status']==200 and r['content_type'].find('text/html')>=0:
        title_groups[r['title']].append(r['url']);desc_groups[r['description']].append(r['url'])
summary={
 'generated_at':time.strftime('%Y-%m-%dT%H:%M:%S%z'),
 'base':BASE,
 'source_routes':len(source_routes),'sitemap_urls':len(sitemap_paths),'subcategory_urls':len(subcat_paths),'page_candidates':len(paths),'asset_refs':len(assets),
 'status_counts':collections.Counter(str(r['status']) for r in page_results),
 'asset_status_counts':collections.Counter(str(r['status']) for r in asset_results),
 'bad_pages':[r for r in page_results if r['status']!=200],
 'bad_assets':[r for r in asset_results if r['status']!=200],
 'missing_title':[r['url'] for r in page_results if r['status']==200 and 'text/html' in r['content_type'] and not r['title']],
 'missing_description':[r['url'] for r in page_results if r['status']==200 and 'text/html' in r['content_type'] and not r['description']],
 'missing_canonical':[r['url'] for r in page_results if r['status']==200 and 'text/html' in r['content_type'] and not r['canonical']],
 'h1_not_one':[{'url':r['url'],'count':r['h1_count']} for r in page_results if r['status']==200 and 'text/html' in r['content_type'] and r['h1_count']!=1],
 'images_missing_alt_total':sum(r['images_missing_alt'] for r in page_results),
 'pages_with_images_missing_alt':[{'url':r['url'],'missing':r['images_missing_alt'],'images':r['images']} for r in page_results if r['images_missing_alt']],
 'duplicate_titles':{k:v for k,v in title_groups.items() if k and len(v)>1},
 'duplicate_descriptions':{k:v[:20] for k,v in desc_groups.items() if k and len(v)>1},
 'external_link_count':len(set().union(*external_links.values())) if external_links else 0,
 'external_domains':collections.Counter(urllib.parse.urlparse(u).netloc for links in external_links.values() for u in links).most_common(50),
}
# convert counters
summary['status_counts']=dict(summary['status_counts']);summary['asset_status_counts']=dict(summary['asset_status_counts'])
json.dump({'summary':summary,'pages':page_results,'assets':asset_results,'static_internal_links':{k:sorted(v) for k,v in html_links.items()},'external_links':{k:sorted(v) for k,v in external_links.items()}},open('/tmp/master-qa-production-live-audit.json','w'),indent=2)
with open('/tmp/master-qa-production-route-inventory.csv','w',newline='') as f:
 fields=['url','status','title','h1','description','canonical','links','buttons','forms','videos','images','images_missing_alt','bytes','final_url','error']
 w=csv.DictWriter(f,fields);w.writeheader();w.writerows([{k:r.get(k,'') for k in fields} for r in page_results])
print(json.dumps({k:(len(v) if isinstance(v,(list,dict)) else v) for k,v in summary.items() if k not in ['external_domains']},indent=2))
print('external_domains',summary['external_domains'][:20])
