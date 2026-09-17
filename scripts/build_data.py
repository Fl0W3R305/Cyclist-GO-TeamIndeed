"""Person 3: prepare BCC snapshots. Does not draw connectors or use external routing.
Input directory must contain BCC exports; see DATA_SOURCES.md.
python3 scripts/build_data.py INPUT_DIR
Dependencies: scipy, shapely. These are build-time only.
"""
import json,math,pathlib,sys,collections,datetime
from scipy.spatial import cKDTree
from shapely.geometry import LineString,box
root=pathlib.Path(__file__).resolve().parents[1]; inputs=pathlib.Path(sys.argv[1]) if len(sys.argv)>1 else root.parent
rows=json.loads((inputs/'bcc-network.json').read_text()); extra=json.loads((inputs/'bcc-existing-network.json').read_text())
nodes=[];ids={};edges=[];adj=collections.defaultdict(set);records=[];seen={}
def node(p):
 key=tuple(round(float(x),7) for x in p[:2])
 if key not in ids:ids[key]=len(nodes);nodes.append([key[1],key[0]])
 return ids[key]
def dist(a,b):
 rad=math.pi/180; q=math.sin((b[0]-a[0])*rad/2)**2+math.cos(a[0]*rad)*math.cos(b[0]*rad)*math.sin((b[1]-a[1])*rad/2)**2
 return 6371000*2*math.atan2(math.sqrt(q),math.sqrt(max(0,1-q)))
for kind,source in [('assets',rows),('existing',extra)]:
 for r in source:
  ri=len(records);records.append({'id':r['objectid'],'dataset':kind,'type':r.get('traffic_types_description'),'position':r.get('bikeway_on_off_road_desc'),'level':r.get('locations_description'),'name':r.get('bikeway_name'),'street':r.get('street_name'),'width':r.get('bikeway_width')})
  g=r['geo_shape']['geometry']; lines=[g['coordinates']] if g['type']=='LineString' else g['coordinates']
  for line in lines:
   ns=[node(p) for p in line]
   for a,b in zip(ns,ns[1:]):
    if a==b:continue
    key=tuple(sorted([a,b]))
    if key in seen:continue
    seen[key]=len(edges);edges.append([a,b,round(dist(nodes[a],nodes[b]),3),ri]);adj[a].add(b);adj[b].add(a)
# Only coordinate-identical BCC vertices (rounded to 7 decimals) are joined.
# No nearest-road snapping, invented bridge, planar-crossing noding or straight-line gap filling.
start_ref=[-27.4735,153.005];start=min(range(len(nodes)),key=lambda i:dist(nodes[i],start_ref));component={start};todo=[start]
while todo:
 for v in adj[todo.pop()]:
  if v not in component:component.add(v);todo.append(v)
old=sorted(component);nm={v:i for i,v in enumerate(old)};nodes2=[nodes[v] for v in old];edges2=[[nm[a],nm[b],m,r] for a,b,m,r in edges if a in component and b in component]
used=sorted({e[3] for e in edges2});rm={r:i for i,r in enumerate(used)};records2=[records[r] for r in used]
for e in edges2:e[3]=rm[e[3]]
start=nm[start]
destinations=[]
for key,name,reference,aliases in [('qut','QUT Gardens Point',[-27.4773,153.028],'qut gardens point botanic gardens'),('qagoma','QAGOMA',[-27.4724,153.0186],'qagoma goma gallery cultural centre'),('northquay','North Quay',[-27.470,153.021],'north quay northquay city')]:
 n=min(range(len(nodes2)),key=lambda i:dist(nodes2[i],reference));offset=round(dist(nodes2[n],reference))
 assert offset<150,(key,offset)
 destinations.append({'id':key,'name':name,'detail':f'BCC cycleway arrival · {offset} m from landmark','aliases':aliases,'icon':'↗','node':n,'reference':reference,'offset':offset})
intersections=json.loads((inputs/'bcc-intersections-all.json').read_text());volumes=json.loads((inputs/'bcc-volume-all.json').read_text())
# Keep one latest observation per TSC + approach. mf is vehicles/cycle; ct is seconds/cycle.
latest={}
for v in volumes:
 k=(v['tsc'],v['lane'])
 if k not in latest or v['recorded']>latest[k]['recorded']:latest[k]=v
sites=[]
for s in intersections:
 try:p=[float(s['latitude']),float(s['longitude'])]
 except (TypeError,KeyError):continue
 if not(-27.49<p[0]<-27.46 and 152.99<p[1]<153.04):continue
 samples=[v for (tsc,lane),v in latest.items() if tsc==s['tsc']]
 rates=[];stamps=[]
 for v in samples:
  try:ct=float(v['ct'])
  except (TypeError,ValueError):continue
  if ct<=0:continue
  values=[]
  for k in range(1,5):
   try:value=float(v.get('mf'+str(k)));assert value>=0;values.append(value)
   except (ValueError,TypeError,AssertionError):pass
  if values:rates.append(sum(values)/ct*3600);stamps.append(v['recorded'])
 arms=json.loads(s.get('arms') or '[]');names=sorted({a.get('streetName','') for a in arms if a.get('streetName')})
 sites.append({'id':s['tsc'],'point':p,'streets':names,'flow':round(sum(rates),1) if rates else None,'recorded':max(stamps) if stamps else None,'approaches':len(rates)})
# Historical ground contours: no inference of bridge deck or tunnel elevation.
terrain=json.loads((inputs/'bcc-terrain.json').read_text()); samples=[];heights=[];clip=box(152.998,-27.487,153.033,-27.465)
for f in terrain['features']:
 h=float(f['attributes']['ELEVATION'])
 for coords in f['geometry']['paths']:
  clipped=LineString(coords).intersection(clip)
  lines=list(clipped.geoms) if hasattr(clipped,'geoms') else [clipped]
  for line in lines:
   if line.geom_type!='LineString' or line.length==0:continue
   count=max(2,math.ceil(line.length*111000/8))
   for i in range(count):
    p=line.interpolate(i/(count-1),normalized=True);samples.append([p.x*99000,p.y*111000]);heights.append(h)
tree=cKDTree(samples);elev=[]
for lat,lon in nodes2:
 ds,ns=tree.query([lon*99000,lat*111000],k=12)
 if ds[0]>50:elev.append(None);continue
 weights=[1/max(float(d),1)**2 for d in ds];elev.append(round(sum(heights[n]*w for n,w in zip(ns,weights))/sum(weights),2))
# Associate network edges with survey sites; these are proximity indicators, not verified crossings.
for e in edges2:
 a,b,_,ri=e;p=[(nodes2[a][0]+nodes2[b][0])/2,(nodes2[a][1]+nodes2[b][1])/2]
 nearby=[(dist(p,s['point']),i) for i,s in enumerate(sites)];nearest=min(nearby) if nearby else (math.inf,None)
 e.append(nearest[1] if nearest[0]<=60 else None)
retrieved=json.loads((inputs/'snapshot-meta.json').read_text())['retrieved'] if (inputs/'snapshot-meta.json').exists() else '2026-09-15'
meta={'retrieved':retrieved,'network':'BCC Bikeway sections + LGIP Existing Bikeway','trafficFrom':min(v['recorded'] for v in volumes),'trafficTo':max(v['recorded'] for v in volumes),'terrainYear':2002,'vertexPrecision':7,'inputSegments':len(rows)+len(extra),'graphNodes':len(nodes2),'graphEdges':len(edges2),'speedKmh':15,'scope':'Milton to nearby BCC cycleway arrivals; no connector to landmark','direction':'Dataset has no legal direction/turn restrictions; undirected planning graph, not navigation'}
data={'meta':meta,'nodes':nodes2,'elevations':elev,'edges':edges2,'records':records2,'start':start,'destinations':destinations,'sites':sites}
(root/'dist/data/bcc-data.js').write_text('/* BCC data only. Attribution and methodology: DATA_SOURCES.md */\nwindow.BCC_DATA='+json.dumps(data,separators=(',',':'))+';\n')
(root/'dist/data/bcc-data.json').write_text(json.dumps(data,separators=(',',':')))
print(json.dumps({'meta':meta,'start':nodes2[start],'destinations':destinations,'sites':len(sites),'elevationCoverage':sum(x is not None for x in elev)/len(elev)},indent=2))
