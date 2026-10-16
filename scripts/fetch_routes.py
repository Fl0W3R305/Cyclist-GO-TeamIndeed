import urllib.request,urllib.parse,json,pathlib,time
import sys
out=pathlib.Path(sys.argv[1] if len(sys.argv)>1 else 'bcc-inputs');out.mkdir(parents=True,exist_ok=True);start='152.9735,-27.4995'
ends={'cityhall':'153.0234,-27.4689','uq':'153.0137,-27.4975','southbank':'153.0235,-27.4812'}
for key,end in ends.items():
 for alt in range(3):
  p=out/f'osm-{key}-{alt}.geojson'
  if p.exists():continue
  q={'lonlats':start+'|'+end,'profile':'trekking','profile:allow_ferries':'0','profile:allow_steps':'0','profile:consider_elevation':'0','alternativeidx':str(alt),'format':'geojson'}
  url='https://brouter.de/brouter?'+urllib.parse.urlencode(q)
  for attempt in range(3):
   try:
    with urllib.request.urlopen(url,timeout=90) as r:d=json.load(r)
    f=d['features'][0]
    if any('route=ferry' in m[9] or 'highway=steps' in m[9] for m in f['properties']['messages'][1:]):raise ValueError('Ferry or steps in route')
    d['request_url']=url;p.write_text(json.dumps(d));print(key,alt,f['properties']['track-length'],flush=True);break
   except Exception as e:
    print(key,alt,attempt,str(e), e.read().decode()[:300] if hasattr(e,'read') else '',flush=True)
    if attempt==2:raise

# Download bridge/tunnel tags around river crossings; BCC structures also exclude ground-height inference.
import urllib.request,xml.etree.ElementTree as ET,concurrent.futures,json,pathlib
boxes=['153.005,-27.475,153.025,-27.465','153.01,-27.5,153.025,-27.493','152.97,-27.508,152.98,-27.5']
def get(box):
 try:
  url='https://api.openstreetmap.org/api/0.6/map?bbox='+box
  r=ET.fromstring(urllib.request.urlopen(url,timeout=40).read());nodes={n.attrib['id']:{'lat':float(n.attrib['lat']),'lon':float(n.attrib['lon'])} for n in r.findall('node')};out=[]
  for w in r.findall('way'):
   tags={t.attrib['k']:t.attrib['v'] for t in w.findall('tag')}
   if 'highway' in tags and ('bridge' in tags or 'tunnel' in tags):out.append({'id':w.attrib['id'],'tags':tags,'geometry':[nodes[n.attrib['ref']] for n in w.findall('nd') if n.attrib['ref'] in nodes]})
  return out
 except Exception as e:print(box,e,flush=True);return []
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:rows=[r for group in pool.map(get,boxes) for r in group]
(out/'osm-structures.json').write_text(json.dumps({'elements':rows,'source':'OpenStreetMap API 0.6 map extracts','bounds':boxes}));print('structures',len(rows),flush=True)

if not rows:raise RuntimeError("OSM structure download returned no features")
