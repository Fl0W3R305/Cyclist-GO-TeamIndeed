"""Person 3: download the exact BCC inputs used by build_data.py.
Usage: python3 scripts/fetch_data.py INPUT_DIR
Network requests are read-only. No external routing service is used.
"""
import concurrent.futures,datetime,json,pathlib,sys,urllib.parse,urllib.request
out=pathlib.Path(sys.argv[1] if len(sys.argv)>1 else 'bcc-inputs');out.mkdir(parents=True,exist_ok=True)
base='https://data.brisbane.qld.gov.au/api/explore/v2.1/catalog/datasets/'
where=urllib.parse.urlencode({'where':"within_distance(geo_shape,geom'POINT(153.012 -27.486)',6000m)"})
urls={
'bcc-network.json':base+'bikeway-sections/exports/json?'+where,
'bcc-existing-network.json':base+'cp14-lgip-pfti-active-and-public-transport-existing-bikeway/exports/json?'+where,
'bcc-intersections-all.json':base+'traffic-management-intersection-locations-reference/exports/json',
'bcc-volume-all.json':base+'traffic-data-at-intersection/exports/json'}
def download(item):
 name,url=item
 with urllib.request.urlopen(url,timeout=120) as response:data=json.load(response)
 if not isinstance(data,list) or not data:raise RuntimeError('Empty/unexpected response: '+name)
 (out/name).write_text(json.dumps(data));print(name,len(data),'records',flush=True)
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:list(pool.map(download,urls.items()))
url='https://services2.arcgis.com/dEKgZETqwmDAh1rP/arcgis/rest/services/Contours_2002_Feature_Service/FeatureServer/0/query'
features=[];offset=0
while True:
 q={'f':'json','where':'1=1','geometry':'152.998,-27.487,153.033,-27.465','geometryType':'esriGeometryEnvelope','inSR':4326,'outSR':4326,'outFields':'OBJECTID,ELEVATION,type','returnGeometry':'true','resultOffset':offset,'resultRecordCount':1000,'orderByFields':'OBJECTID'}
 with urllib.request.urlopen(url+'?'+urllib.parse.urlencode(q),timeout=120) as response:d=json.load(response)
 if 'error' in d or not isinstance(d.get('features'),list):raise RuntimeError('Contour response invalid')
 features.extend(d['features'])
 if not d.get('exceededTransferLimit'):break
 if not d['features']:raise RuntimeError('Contour pagination stalled')
 offset+=len(d['features'])
(out/'bcc-terrain.json').write_text(json.dumps({'features':features,'source':url,'year':2002}))
(out/'snapshot-meta.json').write_text(json.dumps({'retrieved':datetime.datetime.now(datetime.timezone.utc).date().isoformat()}))
print('Complete BCC input snapshot:',out.resolve())
