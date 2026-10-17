"""Build display-only OSM background. Usage: python build_clean_basemap.py raw.json.
Requires shapely. Coordinates for routing in bcc-data are NEVER modified.
Source query and license: CLEAN_MAP_UPDATE.md.
"""
import json,sys
from pathlib import Path
from shapely.geometry import LineString,Polygon,box,mapping
from shapely.ops import polygonize,unary_union
from shapely import make_valid
raw=json.loads(Path(sys.argv[1]).read_text())
bounds=[152.93,-27.58,153.06,-27.43]; clip=box(*bounds)
features=[]
def add(g,props):
 if not g.is_valid:g=make_valid(g)
 g=g.intersection(clip).simplify(0.000015,preserve_topology=True)
 if g.is_empty:return
 if g.geom_type=='GeometryCollection':
  for part in g.geoms:add(part,props)
  return
 features.append({'type':'Feature','properties':props,'geometry':mapping(g)})
def coords(seq):return [(p['lon'],p['lat']) for p in seq if p and 'lon' in p]
for e in raw['elements']:
 t=e.get('tags',{}); name=t.get('name',''); props={'osm':e['type']+'/'+str(e['id']),'name':name}
 if e['type']=='way':
  c=coords(e.get('geometry',[]))
  if len(c)<2:continue
  if 'highway' in t:
   h=t['highway']; tier=0 if h in ['motorway','motorway_link','trunk','trunk_link','primary','primary_link','secondary','secondary_link','tertiary','tertiary_link'] else 2 if h in ['footway','cycleway','path','service','track','pedestrian'] else 1
   add(LineString(c),dict(props,kind='road',tier=tier,bridge=t.get('bridge','no')!='no',highway=h))
  elif len(c)>3 and c[0]==c[-1]:add(Polygon(c),dict(props,kind='water' if t.get('natural')=='water' else 'park'))
 elif e['type']=='relation' and t.get('natural')=='water':
  outer=[];inner=[]
  for m in e.get('members',[]):
   c=coords(m.get('geometry',[]))
   if len(c)>1:(inner if m.get('role')=='inner' else outer).append(LineString(c))
  polys=list(polygonize(outer))
  if polys:
   g=unary_union(polys)
   holes=list(polygonize(inner))
   if holes:g=g.difference(unary_union(holes))
   add(g,dict(props,kind='water'))
# Group linework to keep Leaflet fast; retain names separately for sparse labels.
from collections import defaultdict
roads=defaultdict(list); labels={}; areas=[]
for f in features:
 p=f['properties'];g=f['geometry']
 if p['kind']!='road':areas.append(f);continue
 lines=[g['coordinates']] if g['type']=='LineString' else g['coordinates']
 roads[(p['tier'],p['bridge'])].extend(lines)
 if p['name'] and p['tier']<2:
  for line in lines:
   shape=LineString(line)
   if shape.length>labels.get(p['name'],{}).get('length',0):
    pt=shape.interpolate(0.5,normalized=True)
    labels[p['name']]={'name':p['name'],'point':[pt.y,pt.x],'length':shape.length,'tier':p['tier']}
features=areas+[{'type':'Feature','properties':{'kind':'road','tier':tier,'bridge':bridge},'geometry':{'type':'MultiLineString','coordinates':lines}} for (tier,bridge),lines in roads.items()]
def rounded(v):
 if isinstance(v,float):return round(v,6)
 if isinstance(v,(list,tuple)):return [rounded(x) for x in v]
 if isinstance(v,dict):return {k:rounded(x) for k,x in v.items()}
 return v
features=rounded(features)
data={'type':'FeatureCollection' ,'meta':{'bbox':bounds,'source':'OpenStreetMap / Overpass API','snapshot':raw.get('osm3s',{}).get('timestamp_osm_base'),'license':'ODbL 1.0','displayOnly':True},'features':features,'labels':rounded(sorted(labels.values(),key=lambda x:-x['length']))}
out=Path(__file__).resolve().parents[1]/'dist/data/clean-basemap.js'
out.write_text('window.CLEAN_BASEMAP='+json.dumps(data,separators=(',',':'))+';\n')
from collections import Counter
print(len(features),Counter(f['properties']['kind'] for f in features),out.stat().st_size)
