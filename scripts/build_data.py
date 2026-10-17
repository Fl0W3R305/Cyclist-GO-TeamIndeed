"""Build the Indooroopilly demo from saved OSM/BRouter routes and BCC inputs.
Usage: python3 scripts/build_data.py INPUT_DIR
Build dependencies: numpy scipy shapely. No routing requests at page load.
"""
import json,math,pathlib,sys,datetime
import numpy as np
from scipy.spatial import cKDTree
from shapely.geometry import LineString,Point,box
from shapely.strtree import STRtree
from shapely import line_interpolate_point, get_coordinates
root=pathlib.Path(__file__).resolve().parents[1]; inputs=pathlib.Path(sys.argv[1])
read=lambda name:json.loads((inputs/name).read_text())
def distance(a,b):
 rad=math.pi/180;q=math.sin((b[0]-a[0])*rad/2)**2+math.cos(a[0]*rad)*math.cos(b[0]*rad)*math.sin((b[1]-a[1])*rad/2)**2
 return 12742000*math.atan2(math.sqrt(q),math.sqrt(max(0,1-q)))
def xy(p):return [p[0]*99000,p[1]*111000]
rows=read('bcc-network.json');extra=read('bcc-existing-network.json')
segments=[];segment_records=[];bccNetwork=[]
for kind,source in [('assets',rows),('existing',extra)]:
 for r in source:
  g=r['geo_shape']['geometry'];lines=[g['coordinates']] if g['type']=='LineString' else g['coordinates']
  props={'id':r['objectid'],'dataset':kind,'type':r.get('traffic_types_description'),'position':r.get('bikeway_on_off_road_desc'),'level':r.get('locations_description'),'name':r.get('bikeway_name'),'street':r.get('street_name')}
  bccNetwork.append({'type':'Feature','geometry':g,'properties':{'street_name':props['street'],'bikeway_on_off_road_desc':props['position'],'source_id':props['id']}})
  if kind!='assets':continue
  for line in lines:
   if len(line)<2:continue
   segment=LineString([xy(p) for p in line])
   if segment.length>0:segments.append(segment);segment_records.append(props)
tree=STRtree(segments)
def match(a,b,tags):
 line=LineString([xy(a),xy(b)]);pts=[line.interpolate(t,normalized=True) for t in [.2,.5,.8]];mid=pts[1]
 vec=np.array(xy(b))-xy(a);norm=np.linalg.norm(vec)
 best=None;bestdist=12
 highway=tags.get('highway','');structure=tags.get('bridge','no')!='no' or tags.get('tunnel','no')!='no'
 for index in tree.query(mid.buffer(12)):
  r=segment_records[index];seg=segments[index]
  if structure and r['level'] not in ['ON STRUCTURE','UNDER STRUCTURE','IN TUNNEL']:continue
  if r['position']=='OFF ROAD' and highway not in ['cycleway','path','footway','pedestrian','bridleway']:continue
  pos=seg.project(mid);other=np.array(seg.interpolate(min(seg.length,pos+5)).coords[0])-seg.interpolate(max(0,pos-5)).coords[0]
  cosine=abs(float(np.dot(vec,other)))/(norm*np.linalg.norm(other) or 1)
  if cosine<math.cos(math.radians(25)):continue
  error=max(seg.distance(p) for p in pts)
  if error<bestdist:bestdist=error;best=dict(r)
 if best:best['matchDistance']=round(bestdist,2)
 return best
# OSM structure geometry supplements the route service's reduced way tags.
structure_rows=read('osm-structures.json')['elements']
structure_lines=[LineString([xy([p['lon'],p['lat']]) for p in r['geometry']]) for r in structure_rows]
structure_tree=STRtree(structure_lines)
def structure_tags(a,b,tags):
 result=dict(tags);line=LineString([xy(a),xy(b)]);pts=[line.interpolate(t,normalized=True) for t in [.2,.5,.8]]
 for i in structure_tree.query(pts[1].buffer(2)):
  if max(structure_lines[i].distance(p) for p in pts)<=2:
   for key in ['bridge','tunnel','name']:
    if key in structure_rows[i]['tags']:result[key]=structure_rows[i]['tags'][key]
 return result
nodes=[];nodeids={};edges=[];records=[];recordids={};edgeids={};prepared={};destinations=[]
start_ref=[-27.4995,152.9735]
settings=[('cityhall','Brisbane City Hall',[-27.4689,153.0234],'city hall brisbane king george square'),('uq','UQ St Lucia',[-27.4975,153.0137],'uq university queensland st lucia'),('southbank','South Bank',[-27.4812,153.0235],'southbank south bank parklands')]
def node(p):
 k=tuple(p[:2])
 if k not in nodeids:nodeids[k]=len(nodes);nodes.append([k[1],k[0]])
 return nodeids[k]
start=None
for key,name,ref,aliases in settings:
 prepared[key]=[]
 for alt in range(3):
  doc=read(f'osm-{key}-{alt}.geojson');f=doc['features'][0];coords=[p[:2] for p in f['geometry']['coordinates']]
  tags=[{} for _ in coords[:-1]];last=0
  for m in f['properties']['messages'][1:]:
   t=dict(x.split('=',1) for x in m[9].split() if '=' in x);p=[int(m[0])/1e6,int(m[1])/1e6]
   end=min(range(last,len(coords)),key=lambda i:(coords[i][0]-p[0])**2+(coords[i][1]-p[1])**2)
   for j in range(last,end):tags[j]=t
   last=end
  if last<len(coords)-1:
   for j in range(last,len(coords)-1):tags[j]=tags[last-1] if last else {}
  if any(t.get('route')=='ferry' or t.get('highway') in ['steps','motorway','motorway_link'] for t in tags):raise ValueError('Unacceptable cycling segment')
  ns=[node(p) for p in coords];es=[]
  if start is None:start=ns[0]
  assert start==ns[0], 'All routes must start at the same mapped point'
  assert len(set(ns))==len(ns),'Route contains a loop'
  for i,(a,b) in enumerate(zip(coords,coords[1:])):
   t=structure_tags(a,b,tags[i]);r=match(a,b,t)
   if not r:r={'id':None,'dataset':'osm','type':None,'position':None,'name':None,'street':None}
   r['level']='ON STRUCTURE' if t.get('bridge','no')!='no' else 'IN TUNNEL' if t.get('tunnel','no')!='no' else r.get('level') or 'ON GROUND'
   r['osmTags']=t;r['geometrySource']='OpenStreetMap via BRouter';rkey=json.dumps(r,sort_keys=True)
   if rkey not in recordids:recordids[rkey]=len(records);records.append(r)
   ri=recordids[rkey];ek=(ns[i],ns[i+1],ri)
   if ek not in edgeids:edgeids[ek]=len(edges);edges.append([ns[i],ns[i+1],round(distance(nodes[ns[i]],nodes[ns[i+1]]),3),ri,None,'osm'])
   es.append(edgeids[ek])
  prepared[key].append({'nodeIds':ns,'edgeIds':es,'request':doc.get('request_url'),'alternative':alt})
  print('Prepared',key,alt,len(es),flush=True)
 endpoint=nodes[ns[-1]];offset=round(distance(endpoint,ref));assert offset<100,(key,offset)
 destinations.append({'id':key,'name':name,'detail':f'Mapped path arrival · {offset} m from landmark','aliases':aliases,'icon':'↗','node':ns[-1],'reference':ref,'offset':offset})
# BCC traffic: latest signal-cycle measurement per approach, converted to hourly equivalents.
latest={}
volumes=read('bcc-volume-all.json')
for v in volumes:
 k=(v['tsc'],v['lane'])
 if k not in latest or v['recorded']>latest[k]['recorded']:latest[k]=v
sites=[]
for s in read('bcc-intersections-all.json'):
 try:p=[float(s['latitude']),float(s['longitude'])]
 except (TypeError,KeyError,ValueError):continue
 if not(-27.525<p[0]<-27.455 and 152.965<p[1]<153.04):continue
 rates=[];stamps=[]
 for (tsc,lane),v in latest.items():
  if tsc!=s['tsc']:continue
  try:
   ct=float(v['ct']);values=[float(v[f'mf{k}']) for k in range(1,5) if v.get(f'mf{k}') is not None]
   if ct>0 and values and min(values)>=0:rates.append(sum(values)/ct*3600);stamps.append(v['recorded'])
  except (ValueError,TypeError):continue
 arms=json.loads(s.get('arms') or '[]')
 sites.append({'id':s['tsc'],'point':p,'streets':sorted({a['streetName'] for a in arms if a.get('streetName')}),'flow':round(sum(rates),1) if rates else None,'recorded':max(stamps) if stamps else None,'approaches':len(rates)})
for e in edges:
 a,b=nodes[e[0]],nodes[e[1]];p=[(a[0]+b[0])/2,(a[1]+b[1])/2]
 nearby=min(((distance(p,s['point']),i) for i,s in enumerate(sites)),default=(math.inf,None))
 e[4]=nearby[1] if nearby[0]<=60 else None
# Use only BCC contour heights. The third coordinate from BRouter is deliberately discarded.
cache_path=inputs/'contour-node-cache.json'
previous=json.loads(cache_path.read_text()) if cache_path.exists() else {}
if previous.get('nodes')==nodes:
 elev=previous['elevations'];print('Reusing unchanged contour estimates',flush=True)
else:
 terrain=read('bcc-terrain.json');samples=[];heights=[];clip=box(152.965,-27.525,153.04,-27.455)
 for f in terrain['features']:
  h=float(f['attributes']['ELEVATION'])
  for coords in f['geometry']['paths']:
   clipped=LineString(coords).intersection(clip)
   lines=list(clipped.geoms) if hasattr(clipped,'geoms') else [clipped]
   for line in lines:
    if line.geom_type!='LineString' or not line.length:continue
    count=max(2,math.ceil(line.length*111000/8))
    coords=get_coordinates(line_interpolate_point(line,np.linspace(0,1,count),normalized=True))
    coords[:,0]*=99000;coords[:,1]*=111000
    samples.extend(coords.tolist());heights.extend([h]*count)
 print('Terrain samples',len(samples),flush=True)
 heighttree=cKDTree(samples);elev=[]
 for lat,lon in nodes:
  ds,ns=heighttree.query(xy([lon,lat]),k=12)
  if ds[0]>50:elev.append(None);continue
  weights=[1/max(float(d),1)**2 for d in ds];elev.append(round(sum(heights[n]*w for n,w in zip(ns,weights))/sum(weights),2))
retrieved=read('snapshot-meta.json')['retrieved']
meta={'retrieved':retrieved,'network':'OpenStreetMap cycling geometry via BRouter; BCC spatial indicators','trafficFrom':min(v['recorded'] for v in volumes),'trafficTo':max(v['recorded'] for v in volumes),'terrainYear':2002,'graphNodes':len(nodes),'graphEdges':len(edges),'speedKmh':15,'startName':'Indooroopilly Shopping Centre','startReference':start_ref,'startOffset':round(distance(nodes[start],start_ref)),'scope':'Indooroopilly to City Hall, UQ St Lucia and South Bank','direction':'Saved directed cycling routes, not live navigation','bccMatchToleranceM':12}
data={'meta':meta,'nodes':nodes,'elevations':elev,'edges':edges,'records':records,'start':start,'destinations':destinations,'sites':sites,'preparedRoutes':prepared,'bccNetwork':bccNetwork}
(root/'dist/data/bcc-data.json').write_text(json.dumps(data,separators=(',',':')))
(root/'dist/data/bcc-data.js').write_text('/* OSM route geometry + BCC indicators. See DATA_SOURCES.md. */\nwindow.BCC_DATA='+json.dumps(data,separators=(',',':'))+';\n')
print(json.dumps(meta,indent=2));print('Elevation coverage',sum(h is not None for h in elev)/len(elev))
