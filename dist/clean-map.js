/* Display-only background. Route geometry and route scoring remain unchanged. */
function setupCleanBasemap() {
  const data = window.CLEAN_BASEMAP, map = state.map;
  if (!data || !map) { $('map-error').hidden = false; $('map-error').textContent = 'Local map data missing. Extract the complete ZIP.'; return; }
  const pane = map.createPane('clean-background'); pane.style.zIndex = 210;
  pane.style.pointerEvents = 'none';
  const labelPane=map.createPane('clean-labels');labelPane.style.zIndex=220;labelPane.style.pointerEvents='none';
  const renderer = (L.Browser.canvas ? L.canvas({pane:'clean-background',padding:0.3}) : L.svg({pane:'clean-background'}));
  const group = filter => ({type:'FeatureCollection',features:data.features.filter(filter)});
  const areas = kind => L.geoJSON(group(f=>f.properties.kind===kind),{pane:'clean-background',renderer,interactive:false,style:{stroke:false,fillColor:kind==='water'?'#b9deeb':'#dfecdc',fillOpacity:1,smoothFactor:0}}).addTo(map);
  areas('park'); areas('water');
  const roads = [2,1,0].map(tier => ({tier,layer:L.geoJSON(group(f=>f.properties.kind==='road' && f.properties.tier===tier),{pane:'clean-background',renderer,interactive:false,style:f=>({color:tier===0?'#bdcbd5':tier===1?'#d8dfe4':'#e1e5e7',weight:tier===0?2.3:tier===1?1.4:1,opacity:1,lineCap:'round',smoothFactor:0})})}));
  const labels = L.layerGroup().addTo(map);
  map.attributionControl.addAttribution('© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors · ODbL');
  const b=data.meta.bbox;
  map.setMaxBounds([[b[1],b[0]],[b[3],b[2]]]);
  map.setMinZoom(12); map.setMaxZoom(19);
  const landmarks=[{name:"Indooroopilly",point:D.start},...D.destinations.map(d=>({name:d.name,point:(D.buildRoutes(d.id)[0]||{}).points?.at(-1)}))];
  function update() {
    const z=map.getZoom();
    roads.forEach(({tier,layer})=> { const visible=tier===0 || (tier===1 && z>=14) || z>=16; if(visible && !map.hasLayer(layer))layer.addTo(map); else if(!visible && map.hasLayer(layer))map.removeLayer(layer); });
    labels.clearLayers();
    const placed=[];const seen=new Set();
    const candidates=[...landmarks];
    if(z>=14)candidates.push(...data.labels.filter(l=>z>=16||l.tier===0));
    for(const l of candidates) {
      if(!l.point || seen.has(l.name) || !map.getBounds().contains(l.point))continue;
      const p=map.latLngToContainerPoint(l.point),size=map.getSize();
      if(p.x<70||p.y<60||p.x>size.x-90||p.y>size.y-85)continue;
      if(placed.some(q=>Math.abs(q.x-p.x)<150 && Math.abs(q.y-p.y)<65))continue;
      const node=document.createElement('span');node.textContent=l.name;
      L.marker(l.point,{pane:'clean-labels',interactive:false,keyboard:false,icon:L.divIcon({className:'clean-map-label',html:node,iconSize:[150,20],iconAnchor:[75,10]})}).addTo(labels);
      placed.push(p);seen.add(l.name);if(placed.length>=(z>=16?18:10))break;
    }
  }
  map.on('zoomend moveend',update); update();
}
