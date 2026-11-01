#!/usr/bin/env python3
"""Non-mutating production API and security-header smoke checks for SRCHN."""
import json, urllib.error, urllib.request
BASE='https://srchn.in'
UA={'User-Agent':'SRCHN-regression-smoke/1.0'}
def req(path, method='GET', headers=None, data=None):
    h=dict(UA); h.update(headers or {})
    r=urllib.request.Request(BASE+path,method=method,headers=h,data=data)
    try:
        with urllib.request.urlopen(r,timeout=20) as x: return x.status,dict(x.headers),x.read()
    except urllib.error.HTTPError as e: return e.code,dict(e.headers),e.read()
def main():
    checks={
      'home':req('/'),
      'club':req('/club/'),
      'favicon':req('/favicon.ico'),
      'bad-route':req('/definitely-not-a-real-route-'+str(404)+'/'),
      'discovery-request-unauth':req('/api/discovery-request'),
      'pilot-saved-unauth':req('/discovery/api/pilot/saved'),
      'review-me':req('/review/api/me'),
      'review-requests-unauth':req('/review/api/discovery-requests'),
      'review-media-bad-unauth':req('/review/api/media-file?id=bad'),
    }
    evil={'Origin':'https://evil.invalid','Content-Type':'application/json'}
    checks.update({
      'discovery-request-evil-origin':req('/api/discovery-request','POST',evil,b'{}'),
      'submit-place-evil-origin':req('/api/submit-place','POST',evil,b'{}'),
      'review-logout-evil-origin':req('/review/api/logout','POST',evil,b'{}'),
    })
    result={k:{'status':v[0],'headers':{a:b for a,b in v[1].items() if a.lower() in ['content-security-policy','strict-transport-security','x-frame-options','x-content-type-options','referrer-policy','permissions-policy','access-control-allow-origin','x-robots-tag','x-srchn-release']},'body':v[2][:240].decode('utf-8','replace')} for k,v in checks.items()}
    expectations={
      'home':lambda s:s==200,'club':lambda s:s==200,'favicon':lambda s:s==200,'bad-route':lambda s:s==404,
      'discovery-request-unauth':lambda s:s==401,'pilot-saved-unauth':lambda s:s==401,
      'review-me':lambda s:s==200,'review-requests-unauth':lambda s:s==401,'review-media-bad-unauth':lambda s:s==401,
      'discovery-request-evil-origin':lambda s:s==403,'submit-place-evil-origin':lambda s:s==403,'review-logout-evil-origin':lambda s:s==403,
    }
    failures={k:result[k]['status'] for k,ok in expectations.items() if not ok(result[k]['status'])}
    print(json.dumps({'base':BASE,'checks':result,'failures':failures},indent=2))
    if failures: raise SystemExit(1)
if __name__=='__main__': main()
