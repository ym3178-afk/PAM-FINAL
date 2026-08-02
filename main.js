const sections=[...document.querySelectorAll('.slide')];
const nav=document.getElementById('nav');
sections.forEach((section,index)=>{
  const link=document.createElement('a');
  link.href=`#${section.id}`;
  link.innerHTML=`<span class="nav-number">${String(index+1).padStart(2,'0')}</span><span class="nav-name">${section.dataset.title}</span>`;
  nav.appendChild(link);
});
const links=[...nav.querySelectorAll('a')];
const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{
  if(entry.isIntersecting){
    links.forEach(link=>link.classList.toggle('active',link.getAttribute('href')===`#${entry.target.id}`));
  }
}),{threshold:.42});
sections.forEach(section=>observer.observe(section));

const TOKEN='pk.eyJ1IjoiZWxpYW4zMTc4IiwiYSI6ImNtcnZlZGpkdDBvbXgyd3B2eGMyajdseDUifQ.GlgugnGUmcRzqOLIaF_16w';

// Chapter 07: realistic multi-route situated simulator
const realisticCases={
  'broadway-west-harlem':{
    name:'Broadway restaurant → West Harlem apartment',
    origin:[-73.9645,40.8070],destination:[-73.9538,40.8186],entrance:[-73.9541,40.8184],
    localWaypoint:[-73.9604,40.8125],safeWaypoint:[-73.9576,40.8152]
  },
  'amsterdam-columbia':{
    name:'Amsterdam restaurant → Columbia residence',
    origin:[-73.9598,40.8115],destination:[-73.9628,40.8075],entrance:[-73.9625,40.8078],
    localWaypoint:[-73.9591,40.8096],safeWaypoint:[-73.9610,40.8090]
  },
  '125-morningside':{
    name:'125th Street restaurant → Morningside building',
    origin:[-73.9581,40.8158],destination:[-73.9552,40.8068],entrance:[-73.9554,40.8070],
    localWaypoint:[-73.9563,40.8116],safeWaypoint:[-73.9549,40.8110]
  }
};
const realisticAnchors=[
  {hour:0,traffic:18,wait:3,access:76,entrance:8,weather:35,bike:42},
  {hour:8,traffic:48,wait:6,access:46,entrance:4,weather:22,bike:78},
  {hour:12,traffic:55,wait:9,access:55,entrance:5,weather:30,bike:70},
  {hour:18,traffic:88,wait:15,access:68,entrance:8,weather:42,bike:54},
  {hour:22,traffic:38,wait:8,access:84,entrance:11,weather:62,bike:38},
  {hour:24,traffic:18,wait:3,access:76,entrance:8,weather:35,bike:42}
];
const realisticState={
  hour:12,playing:false,timer:null,map:null,mapReady:false,caseKey:'broadway-west-harlem',
  routes:[],selectedId:null,recommendedId:null,markers:{},requestSerial:0,abortController:null
};
const realisticControls={
  traffic:document.getElementById('realisticTraffic'),wait:document.getElementById('realisticWait'),
  access:document.getElementById('realisticAccess'),entrance:document.getElementById('realisticEntrance'),
  weather:document.getElementById('realisticWeather'),bike:document.getElementById('realisticBike')
};
function realisticFormatTime(hour){const suffix=hour>=12?'PM':'AM';return `${hour%12||12}:00 ${suffix}`;}
function realisticProfile(hour){
  const h=Number(hour);
  let a=realisticAnchors[0],b=realisticAnchors[1];
  for(let i=0;i<realisticAnchors.length-1;i++){
    if(h>=realisticAnchors[i].hour&&h<=realisticAnchors[i+1].hour){a=realisticAnchors[i];b=realisticAnchors[i+1];break;}
  }
  const t=(h-a.hour)/Math.max(1,b.hour-a.hour);
  return Object.fromEntries(['traffic','wait','access','entrance','weather','bike'].map(key=>[key,Math.round(a[key]+(b[key]-a[key])*t)]));
}
function realisticValues(){return Object.fromEntries(Object.entries(realisticControls).map(([key,input])=>[key,Number(input?.value||0)]));}
function realisticApplyProfile(hour){
  const profile=realisticProfile(hour);
  Object.entries(profile).forEach(([key,value])=>{if(realisticControls[key])realisticControls[key].value=value;});
  realisticUpdateModel();
}
function realisticSetStatus(text,isError=false){
  const status=document.getElementById('realisticMapStatus');
  if(status){status.textContent=text;status.classList.toggle('is-error',isError);}
}
function realisticLineFeature(route,selected=false){
  return {type:'Feature',properties:{routeId:route.id,role:route.role,selected},geometry:{type:'LineString',coordinates:route.coordinates}};
}
function realisticFeatureCollection(){
  return {type:'FeatureCollection',features:realisticState.routes.map(route=>realisticLineFeature(route,route.id===realisticState.selectedId))};
}
function realisticMarkerElement(letter,className){
  const el=document.createElement('div');el.className=`realistic-marker ${className}`;el.textContent=letter;return el;
}
function realisticCurrentCase(){return realisticCases[realisticState.caseKey];}
function realisticMarkerCoords(){
  const c=realisticCurrentCase();
  return {
    origin:realisticState.markers.origin?.getLngLat().toArray()||c.origin,
    destination:realisticState.markers.destination?.getLngLat().toArray()||c.destination,
    entrance:realisticState.markers.entrance?.getLngLat().toArray()||c.entrance
  };
}
function realisticDirectionsUrl(coords,alternatives=false){
  const path=coords.map(c=>`${c[0]},${c[1]}`).join(';');
  const params=new URLSearchParams({alternatives:String(alternatives),geometries:'geojson',overview:'full',steps:'true',access_token:TOKEN});
  return `https://api.mapbox.com/directions/v5/mapbox/cycling/${path}?${params.toString()}`;
}
async function realisticRequest(coords,{alternatives=false,role='alternative',label='Route'}={}){
  const response=await fetch(realisticDirectionsUrl(coords,alternatives),{signal:realisticState.abortController?.signal});
  if(!response.ok)throw new Error(`Directions request failed (${response.status})`);
  const data=await response.json();
  if(data.code!=='Ok'||!Array.isArray(data.routes)||!data.routes.length)throw new Error(data.message||'No route returned');
  return data.routes.map((route,index)=>({
    id:`${role}-${label.toLowerCase().replace(/[^a-z0-9]+/g,'-')}-${index}`,
    name:index===0?label:`${label} ${index+1}`,
    role:index===0?role:'alternative',
    coordinates:route.geometry.coordinates,
    distance:route.distance,
    duration:route.duration,
    source:'Mapbox cycling network'
  }));
}
function realisticDedupe(routes){
  const result=[];
  routes.forEach(route=>{
    const duplicate=result.some(existing=>Math.abs(existing.distance-route.distance)<35&&Math.abs(existing.duration-route.duration)<18);
    if(!duplicate)result.push(route);
  });
  return result.slice(0,6);
}
async function realisticFetchRoutes(){
  const serial=++realisticState.requestSerial;
  realisticState.abortController?.abort();
  realisticState.abortController=new AbortController();
  realisticSetStatus('Calculating multiple street-following routes…');
  document.getElementById('realisticFallback')?.classList.remove('is-hidden');
  const c=realisticCurrentCase();
  const points=realisticMarkerCoords();
  try{
    const batches=await Promise.all([
      realisticRequest([points.origin,points.destination],{alternatives:true,role:'platform',label:'Platform fastest'}),
      realisticRequest([points.origin,points.entrance,points.destination],{role:'access',label:'Access-aware'}),
      realisticRequest([points.origin,c.localWaypoint,points.destination],{role:'local',label:'Modeled local-knowledge'}),
      realisticRequest([points.origin,c.safeWaypoint,points.destination],{role:'safe',label:'Weather / bike-aware'})
    ]);
    if(serial!==realisticState.requestSerial)return;
    const routes=realisticDedupe(batches.flat());
    routes.forEach((route,index)=>route.id=`route-${serial}-${index}`);
    realisticState.routes=routes;
    realisticState.selectedId=routes[0]?.id||null;
    realisticState.recommendedId=routes[0]?.id||null;
    realisticUpdateModel(true);
    realisticUpdateMapRoutes(true);
    realisticSetStatus(`${routes.length} street-following routes ready`);
    document.getElementById('realisticFallback')?.classList.add('is-hidden');
  }catch(error){
    if(error.name==='AbortError')return;
    realisticState.routes=[];realisticState.selectedId=null;
    realisticRenderRouteCards();realisticUpdateMetrics();
    realisticSetStatus(`${error.message}. No schematic route has been substituted.`,true);
    const fallback=document.getElementById('realisticFallback');
    if(fallback){fallback.classList.remove('is-hidden');fallback.querySelector('strong').textContent='Routing unavailable';fallback.querySelector('span').textContent='Check the Mapbox token or network connection. The simulator intentionally avoids displaying invented street routes.';}
  }
}
function realisticRouteMetrics(route,values){
  if(!route)return null;
  const base=route.duration/60;
  const trafficScale=route.role==='local'?0.72:route.role==='safe'?0.84:1;
  const weatherScale=route.role==='safe'?0.58:1;
  const bikeScale=route.role==='safe'?0.55:route.role==='local'?0.82:1;
  const condition=base*((values.traffic/100)*.18*trafficScale+(values.weather/100)*.32*weatherScale+((100-values.bike)/100)*.18*bikeScale);
  const accessScale=route.role==='access'?.42:1;
  const access=values.entrance+(values.access/100)*6*accessScale;
  const wait=values.wait;
  const total=base+condition+wait+access;
  const uncertainty=2+(values.traffic+values.weather+values.access)/100*1.15;
  return {base,condition,wait,access,total,uncertainty};
}
function realisticPlatformRoute(){return realisticState.routes.find(route=>route.role==='platform')||realisticState.routes[0]||null;}
function realisticRecommendation(values){
  let best=null;
  realisticState.routes.forEach(route=>{
    const metrics=realisticRouteMetrics(route,values);if(!metrics)return;
    let score=metrics.total;
    if(values.access>62&&route.role!=='access')score+=5.5;
    if((values.weather>58||values.bike<46)&&route.role!=='safe')score+=4.5;
    if(values.traffic>72&&route.role==='platform')score+=3;
    if(!best||score<best.score)best={id:route.id,score};
  });
  return best?.id||realisticState.routes[0]?.id||null;
}
function realisticRouteExplanation(route,values){
  if(!route)return 'Route data is unavailable.';
  if(route.role==='access')return 'This route passes through the draggable entrance point, making access friction spatial rather than treating it as an invisible delay only.';
  if(route.role==='safe')return 'This modeled corridor tests how a rider may prefer a different street sequence when weather exposure rises or bike-lane availability falls.';
  if(route.role==='local')return 'This route tests a rider-selected local corridor rather than assuming the platform’s first result is always followed.';
  if(values.access>62)return 'The platform-fastest route is spatially plausible, but it does not itself resolve the entrance and access conditions added by the model.';
  return 'This is the fastest cycling route returned by the road network. Waiting, weather, access, and labor remain separate modeled layers.';
}
function realisticRenderRouteCards(){
  const root=document.getElementById('realisticRouteCards');if(!root)return;
  const values=realisticValues();
  document.getElementById('realisticRouteCount').textContent=`${realisticState.routes.length} route${realisticState.routes.length===1?'':'s'}`;
  if(!realisticState.routes.length){root.innerHTML='<div class="route-empty">No routes available.</div>';return;}
  root.innerHTML=realisticState.routes.map((route,index)=>{
    const m=realisticRouteMetrics(route,values);
    const selected=route.id===realisticState.selectedId;
    const recommended=route.id===realisticState.recommendedId;
    return `<button type="button" class="realistic-route-card${selected?' is-selected':''}" data-route-id="${route.id}">
      <span class="rr-index">${String(index+1).padStart(2,'0')}</span>
      <span class="rr-copy"><b>${route.name}</b><small>${(route.distance/1000).toFixed(2)} km · ${Math.round(route.duration/60)} min network time</small></span>
      <span class="rr-total">${Math.round(m.total)}<small>min</small></span>
      ${recommended?'<em>Recommended</em>':''}
    </button>`;
  }).join('');
  root.querySelectorAll('[data-route-id]').forEach(button=>button.addEventListener('click',()=>realisticSelectRoute(button.dataset.routeId,true)));
}
function realisticSelectRoute(id,manual=false){
  if(!realisticState.routes.some(route=>route.id===id))return;
  realisticState.selectedId=id;
  realisticRenderRouteCards();realisticUpdateMapRoutes(false);realisticUpdateMetrics();
}
function realisticUpdateMetrics(){
  const values=realisticValues();
  const selected=realisticState.routes.find(route=>route.id===realisticState.selectedId);
  const platform=realisticPlatformRoute();
  if(!selected||!platform){
    ['realisticPlatformEta','realisticActualTime','realisticHiddenTime','realisticRange','realisticBaseTime','realisticConditionTime','realisticWaitTime','realisticAccessTime'].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent='—';});
    return;
  }
  const m=realisticRouteMetrics(selected,values);
  const platformEta=platform.duration/60+3;
  const hidden=Math.max(0,m.total-platformEta);
  const min=Math.max(0,m.total-m.uncertainty),max=m.total+m.uncertainty;
  document.getElementById('realisticPlatformEta').textContent=`${Math.round(platformEta)} min`;
  document.getElementById('realisticActualTime').textContent=`${Math.round(m.total)} min`;
  document.getElementById('realisticHiddenTime').textContent=`+${Math.round(hidden)} min`;
  document.getElementById('realisticRange').textContent=`${Math.round(min)}–${Math.round(max)} min`;
  document.getElementById('realisticSelectedName').textContent=selected.name;
  document.getElementById('realisticBaseTime').textContent=`${Math.round(m.base)} min`;
  document.getElementById('realisticConditionTime').textContent=`${Math.round(m.condition)} min`;
  document.getElementById('realisticWaitTime').textContent=`${Math.round(m.wait)} min`;
  document.getElementById('realisticAccessTime').textContent=`${Math.round(m.access)} min`;
  document.getElementById('realisticExplanation').textContent=realisticRouteExplanation(selected,values);
  const total=Math.max(1,m.total);
  const parts={realisticBaseSegment:m.base,realisticConditionSegment:m.condition,realisticWaitSegment:m.wait,realisticAccessSegment:m.access};
  Object.entries(parts).forEach(([id,value])=>{const el=document.getElementById(id);if(el)el.style.width=`${Math.max(2,value/total*100)}%`;});
}
function realisticUpdateControlLabels(){
  const v=realisticValues();
  document.getElementById('realisticTrafficValue').textContent=`${v.traffic}%`;
  document.getElementById('realisticWaitValue').textContent=`${v.wait} min`;
  document.getElementById('realisticAccessValue').textContent=`${v.access}%`;
  document.getElementById('realisticEntranceValue').textContent=`${v.entrance} min`;
  document.getElementById('realisticWeatherValue').textContent=`${v.weather}%`;
  document.getElementById('realisticBikeValue').textContent=`${v.bike}%`;
  document.getElementById('realisticTimeOutput').textContent=realisticFormatTime(realisticState.hour);
  document.getElementById('realisticTime').value=realisticState.hour;
  document.querySelectorAll('[data-realistic-hour]').forEach(button=>button.classList.toggle('active',Number(button.dataset.realisticHour)===realisticState.hour));
}
function realisticUpdateModel(preserveSelection=false){
  realisticUpdateControlLabels();
  const values=realisticValues();
  realisticState.recommendedId=realisticRecommendation(values);
  if(!preserveSelection||!realisticState.routes.some(route=>route.id===realisticState.selectedId))realisticState.selectedId=realisticState.recommendedId;
  realisticRenderRouteCards();realisticUpdateMapRoutes(false);realisticUpdateMetrics();
}
function realisticUpdateMapRoutes(fit=false){
  if(!realisticState.mapReady)return;
  const source=realisticState.map.getSource('realistic-routes');
  if(source)source.setData(realisticFeatureCollection());
  const selected=realisticState.routes.find(route=>route.id===realisticState.selectedId);
  if(selected){
    realisticState.map.setFilter('realistic-selected',['==',['get','routeId'],selected.id]);
  }
  if(fit&&realisticState.routes.length){
    const bounds=new mapboxgl.LngLatBounds();realisticState.routes.forEach(route=>route.coordinates.forEach(coord=>bounds.extend(coord)));
    realisticState.map.fitBounds(bounds,{padding:65,duration:700,maxZoom:15.5});
  }
}
function realisticPlaceMarkers(){
  if(!realisticState.mapReady)return;
  const c=realisticCurrentCase();
  Object.values(realisticState.markers).forEach(marker=>marker.remove());realisticState.markers={};
  const defs=[['origin','R','marker-origin',c.origin],['destination','C','marker-customer',c.destination],['entrance','E','marker-entrance',c.entrance]];
  defs.forEach(([key,letter,className,coord])=>{
    const marker=new mapboxgl.Marker({element:realisticMarkerElement(letter,className),draggable:true}).setLngLat(coord).addTo(realisticState.map);
    marker.on('dragend',()=>realisticFetchRoutes());realisticState.markers[key]=marker;
  });
}
function realisticInitMap(){
  if(!window.mapboxgl){realisticSetStatus('Mapbox GL JS did not load.',true);return;}
  mapboxgl.accessToken=TOKEN;
  realisticState.map=new mapboxgl.Map({container:'realisticMap',style:'mapbox://styles/mapbox/dark-v11',center:[-73.9595,40.812],zoom:14.1,pitch:32,bearing:-10,attributionControl:false});
  realisticState.map.addControl(new mapboxgl.NavigationControl({showCompass:false}),'top-right');
  realisticState.map.on('load',()=>{
    realisticState.mapReady=true;
    realisticState.map.addSource('realistic-routes',{type:'geojson',data:{type:'FeatureCollection',features:[]}});
    realisticState.map.addLayer({id:'realistic-alternatives',type:'line',source:'realistic-routes',filter:['!=',['get','role'],'platform'],paint:{'line-color':'#7b7b7b','line-width':4,'line-opacity':.5}});
    realisticState.map.addLayer({id:'realistic-platform',type:'line',source:'realistic-routes',filter:['==',['get','role'],'platform'],paint:{'line-color':'#ffffff','line-width':5,'line-opacity':.84,'line-dasharray':[2,2]}});
    realisticState.map.addLayer({id:'realistic-selected',type:'line',source:'realistic-routes',filter:['==',['get','routeId'],'__none__'],paint:{'line-color':'#ff3348','line-width':7,'line-opacity':.96}});
    realisticState.map.addLayer({id:'realistic-hit',type:'line',source:'realistic-routes',paint:{'line-color':'rgba(0,0,0,0)','line-width':18}});
    realisticState.map.on('mouseenter','realistic-hit',()=>realisticState.map.getCanvas().style.cursor='pointer');
    realisticState.map.on('mouseleave','realistic-hit',()=>realisticState.map.getCanvas().style.cursor='');
    realisticState.map.on('click','realistic-hit',event=>{const id=event.features?.[0]?.properties?.routeId;if(id)realisticSelectRoute(id,true);});
    realisticPlaceMarkers();realisticFetchRoutes();
  });
  realisticState.map.on('error',()=>realisticSetStatus('Map style or routing service unavailable.',true));
}
Object.values(realisticControls).forEach(input=>input?.addEventListener('input',()=>realisticUpdateModel(true)));
document.getElementById('realisticCase')?.addEventListener('change',event=>{realisticState.caseKey=event.target.value;realisticPlaceMarkers();realisticFetchRoutes();});
document.getElementById('realisticTime')?.addEventListener('input',event=>{realisticState.hour=Number(event.target.value);realisticApplyProfile(realisticState.hour);});
document.querySelectorAll('[data-realistic-hour]').forEach(button=>button.addEventListener('click',()=>{realisticState.hour=Number(button.dataset.realisticHour);realisticApplyProfile(realisticState.hour);}));
document.getElementById('realisticReset')?.addEventListener('click',()=>realisticApplyProfile(realisticState.hour));
document.getElementById('realisticRecalculate')?.addEventListener('click',realisticFetchRoutes);
document.getElementById('realisticPlay')?.addEventListener('click',()=>{
  realisticState.playing=!realisticState.playing;
  const button=document.getElementById('realisticPlay');if(button)button.textContent=realisticState.playing?'Pause':'Play';
  if(realisticState.timer){clearInterval(realisticState.timer);realisticState.timer=null;}
  if(realisticState.playing)realisticState.timer=setInterval(()=>{realisticState.hour=(realisticState.hour+1)%24;realisticApplyProfile(realisticState.hour);},900);
});
if(document.getElementById('realisticMap')){realisticApplyProfile(12);realisticInitMap();}


// Title-slide adjustable route study
const heroControls={
  traffic:document.getElementById('trafficControl'),
  access:document.getElementById('accessControl'),
  slope:document.getElementById('slopeControl'),
  wait:document.getElementById('waitControl'),
  weather:document.getElementById('weatherControl'),
  bike:document.getElementById('bikeControl')
};
const heroRoutes={
  direct:'M90 320L130 320L130 240L250 240L250 160L370 160L370 80L610 80L610 120L650 120',
  traffic:'M90 320L130 320L130 240L250 240L250 320L490 320L490 240L610 240L610 120L650 120',
  access:'M90 320L130 320L130 240L250 240L250 80L490 80L490 160L610 160L610 120L650 120',
  slope:'M90 320L130 320L130 240L250 240L250 160L370 160L370 240L610 240L610 120L650 120',
  combined:'M90 320L130 320L130 240L250 240L250 80L370 80L370 160L490 160L490 240L610 240L610 120L650 120'
};
function updateHeroRoute(){
  if(!heroControls.traffic)return;
  const traffic=Number(heroControls.traffic.value);
  const access=Number(heroControls.access.value);
  const slope=Number(heroControls.slope.value);
  const wait=Number(heroControls.wait.value);
  const weather=Number(heroControls.weather.value);
  const bike=Number(heroControls.bike.value);
  document.getElementById('trafficValue').textContent=`${traffic}%`;
  document.getElementById('accessValue').textContent=`${access}%`;
  document.getElementById('slopeValue').textContent=`${slope}%`;
  document.getElementById('waitValue').textContent=`${wait} min`;
  document.getElementById('weatherValue').textContent=`${weather}%`;
  document.getElementById('bikeValue').textContent=`${bike}%`;

  // choose route mode based on dominant constraints
  let key='direct',label='Balanced route',distance=2.4,detour=.3;
  const blockers=[traffic>58,access>58,slope>58,weather>58,bike<42].filter(Boolean).length;
  if(blockers>=3){key='combined';label='Multi-friction detour';distance=3.3;detour=1.2;}
  else if(access>62){key='access';label='Access-aware route';distance=2.8;detour=.7;}
  else if(traffic>62){key='traffic';label='Traffic-avoiding route';distance=2.9;detour=.8;}
  else if(slope>62){key='slope';label='Slope-avoiding route';distance=2.6;detour=.5;}
  else if(weather>62){key='combined';label='Weather-sheltered route';distance=3.0;detour=.9;}
  else if(bike<42){key='traffic';label='Bike-safe route';distance=2.7;detour=.6;}

  const frictionScore=(traffic+access+slope+weather+(100-bike))/5;
  const travel=Math.round(distance/13*60 + wait + traffic*.05 + access*.035 + slope*.025 + weather*.03 + (100-bike)*.025);
  document.getElementById('heroActiveRoute').setAttribute('d',heroRoutes[key]);
  document.getElementById('heroRouteMode').textContent=label;
  document.getElementById('heroEta').textContent=`${travel} min`;
  document.getElementById('heroDistance').textContent=`${distance.toFixed(1)} km`;
  document.getElementById('heroDetour').textContent=`+${detour.toFixed(1)} km`;
  document.getElementById('heroFriction').textContent=frictionScore>67?'High':frictionScore>35?'Medium':'Low';
  document.getElementById('heroTraffic').style.opacity=.25+traffic/135;
  document.getElementById('heroCampus').style.opacity=.25+access/135;
  document.getElementById('heroSlope').style.opacity=.25+slope/135;
  const weatherBadge = document.getElementById('weatherBadge');
  const bikeBadge = document.getElementById('bikeBadge');
  if(weatherBadge) weatherBadge.textContent = weather>70 ? 'Heavy rain / heat exposure' : weather>40 ? 'Moderate weather exposure' : 'Clear weather';
  if(bikeBadge) bikeBadge.textContent = bike<35 ? 'Weak bike lane coverage' : bike<70 ? 'Partial bike lane coverage' : 'Strong bike lane coverage';
}
Object.values(heroControls).forEach(control=>control&&control.addEventListener('input',updateHeroRoute));
updateHeroRoute();


// Chapter 03: animated keyword network
const keywordData={
  food:{index:'01',role:'Research object',title:'Food delivery',text:'The concrete urban process through which the project studies platforms, labor, movement, and everyday infrastructure.',tags:['Restaurant','Rider','Customer']},
  route:{index:'02',role:'Spatial entry point',title:'Route',text:'The route is not a neutral line. It is the visible outcome of platform decisions, rider judgment, street conditions, and building access.',tags:['Platform route','Experienced route','Detour']},
  infrastructure:{index:'03',role:'Hidden system',title:'Invisible infrastructure',text:'Digital, physical, and institutional systems support delivery while remaining largely absent from the customer interface.',tags:['GPS','Access rules','Payment']},
  labor:{index:'04',role:'Labor condition',title:'Platform labor',text:'Delivery work is organized through algorithms, ratings, time pressure, incentives, waiting, and embodied risk.',tags:['Waiting','Rating','Risk']},
  visualization:{index:'05',role:'Research method',title:'Critical visualization',text:'Mapping and interaction reveal hidden relations while distinguishing observation, simulation, uncertainty, and missing data.',tags:['Evidence','Uncertainty','Missing data']}
};
const keywordNetwork=document.getElementById('keywordNetwork');
const keywordDetail=keywordNetwork?.closest('.keyword-experience')?.querySelector('.keyword-detail');
const keywordNodes=[...document.querySelectorAll('.keyword-node')];
let keywordActive='route';
let keywordTimer=null;
function setKeyword(key,manual=false){
  const data=keywordData[key];
  if(!data||!keywordNetwork)return;
  keywordActive=key;
  keywordNetwork.dataset.active=key;
  keywordNodes.forEach(node=>node.classList.toggle('active',node.dataset.keyword===key));
  if(keywordDetail){
    keywordDetail.classList.remove('is-changing');
    void keywordDetail.offsetWidth;
    keywordDetail.classList.add('is-changing');
  }
  document.getElementById('keywordDetailIndex').textContent=data.index;
  document.getElementById('keywordDetailRole').textContent=data.role;
  document.getElementById('keywordDetailTitle').textContent=data.title;
  document.getElementById('keywordDetailText').textContent=data.text;
  document.getElementById('keywordDetailTags').innerHTML=data.tags.map(tag=>`<span>${tag}</span>`).join('');
  if(manual) restartKeywordCycle();
}
function restartKeywordCycle(){
  if(keywordTimer) clearInterval(keywordTimer);
  const order=['route','food','infrastructure','labor','visualization'];
  keywordTimer=setInterval(()=>{
    const next=order[(order.indexOf(keywordActive)+1)%order.length];
    setKeyword(next,false);
  },4200);
}
keywordNodes.forEach(node=>{
  node.addEventListener('mouseenter',()=>setKeyword(node.dataset.keyword,true));
  node.addEventListener('focus',()=>setKeyword(node.dataset.keyword,true));
  node.addEventListener('click',()=>setKeyword(node.dataset.keyword,true));
});
if(keywordNetwork){
  keywordNetwork.dataset.active='route';
  keywordNetwork.addEventListener('mouseenter',()=>{if(keywordTimer){clearInterval(keywordTimer);keywordTimer=null;}});
  keywordNetwork.addEventListener('mouseleave',restartKeywordCycle);
  const keywordObserver=new IntersectionObserver(entries=>entries.forEach(entry=>{
    if(entry.isIntersecting) restartKeywordCycle();
    else if(keywordTimer){clearInterval(keywordTimer);keywordTimer=null;}
  }),{threshold:.35});
  keywordObserver.observe(document.getElementById('s03'));
  setKeyword('route',false);
}


// Chapter 04: animated intersecting-fields diagram
const fieldData={
  computational:{index:'01',role:'Movement · Model and simulate',title:'Computational design',text:'Builds route comparisons and parameter-based simulations that show how traffic, access, slope, waiting, weather, and bicycle infrastructure change a delivery.',contribution:'Turns hidden conditions into adjustable spatial relationships.',tags:['Simulation','Network analysis','Interaction']},
  logistics:{index:'02',role:'Movement · Trace urban flows',title:'Urban logistics',text:'Explains last-mile movement through distance, time, demand, waiting, street networks, restaurants, and delivery destinations.',contribution:'Provides the operational structure of the delivery journey.',tags:['Last mile','Distance','Waiting']},
  platform:{index:'03',role:'Power · Read algorithmic space',title:'Platform urbanism',text:'Examines how digital platforms use interfaces, location data, ETA predictions, payments, ratings, and dispatch rules to organize urban movement.',contribution:'Frames the route as a platform-produced spatial outcome.',tags:['Algorithm','ETA','Platform rules']},
  labor:{index:'04',role:'Power · Center worker experience',title:'Labor studies',text:'Focuses on rider judgment, waiting, risk, physical effort, ratings, incentives, and the gap between measured performance and lived experience.',contribution:'Makes the labor behind customer convenience visible.',tags:['Rider judgment','Risk','Algorithmic management']},
  cartography:{index:'05',role:'Representation · Question the map',title:'Critical cartography',text:'Treats the route map as a selective representation that highlights location and speed while omitting access friction, uncertainty, and embodied time.',contribution:'Challenges the apparent neutrality of the platform map.',tags:['Representation','Omission','Uncertainty']},
  infrastructure:{index:'06',role:'Representation · Reveal dependencies',title:'Infrastructure studies',text:'Connects streets, bicycle lanes, buildings, doors, elevators, GPS, payment systems, communication networks, and institutional rules.',contribution:'Shows the physical, digital, and institutional systems behind the line.',tags:['Access','Protocols','Hidden systems']}
};
const fieldsMap=document.getElementById('fieldsMap');
const fieldDetail=fieldsMap?.closest('.fields-experience')?.querySelector('.field-detail');
const fieldNodes=[...document.querySelectorAll('.field-node')];
let fieldActive='computational';
let fieldTimer=null;
function setField(key,manual=false){
  const data=fieldData[key];
  if(!data||!fieldsMap)return;
  fieldActive=key;
  fieldsMap.dataset.active=key;
  fieldNodes.forEach(node=>node.classList.toggle('active',node.dataset.field===key));
  if(fieldDetail){
    fieldDetail.classList.remove('is-changing');
    void fieldDetail.offsetWidth;
    fieldDetail.classList.add('is-changing');
  }
  document.getElementById('fieldDetailIndex').textContent=data.index;
  document.getElementById('fieldDetailRole').textContent=data.role;
  document.getElementById('fieldDetailTitle').textContent=data.title;
  document.getElementById('fieldDetailText').textContent=data.text;
  document.getElementById('fieldDetailContribution').textContent=data.contribution;
  document.getElementById('fieldDetailTags').innerHTML=data.tags.map(tag=>`<span>${tag}</span>`).join('');
  if(manual) restartFieldCycle();
}
function restartFieldCycle(){
  if(fieldTimer) clearInterval(fieldTimer);
  const order=['computational','logistics','platform','labor','cartography','infrastructure'];
  fieldTimer=setInterval(()=>{
    const next=order[(order.indexOf(fieldActive)+1)%order.length];
    setField(next,false);
  },4400);
}
fieldNodes.forEach(node=>{
  node.addEventListener('mouseenter',()=>setField(node.dataset.field,true));
  node.addEventListener('focus',()=>setField(node.dataset.field,true));
  node.addEventListener('click',()=>setField(node.dataset.field,true));
});
if(fieldsMap){
  fieldsMap.dataset.active='computational';
  fieldsMap.addEventListener('mouseenter',()=>{if(fieldTimer){clearInterval(fieldTimer);fieldTimer=null;}});
  fieldsMap.addEventListener('mouseleave',restartFieldCycle);
  const fieldsObserver=new IntersectionObserver(entries=>entries.forEach(entry=>{
    if(entry.isIntersecting) restartFieldCycle();
    else if(fieldTimer){clearInterval(fieldTimer);fieldTimer=null;}
  }),{threshold:.35});
  fieldsObserver.observe(document.getElementById('s04'));
  setField('computational',false);
}


// Chapter 05: animated historical lineage
const lineageData={
  local:{
    index:'01',
    type:'Local systems',
    title:'Traditional local food supply',
    text:'Food moved through nearby farms, markets, street vendors, local shops, and households. The seller, source, and movement of food were comparatively visible.',
    continueText:'Producer → local market or shop → household.',
    transform:'Proximity, seasonal availability, face-to-face exchange, and local knowledge organized the network.',
    tags:['Local markets','Short chains','Visible exchange'],
    progress:'10%'
  },
  coldchain:{
    index:'02',
    type:'19th–20th century',
    title:'Industrial logistics and cold chain',
    text:'Railways, trucks, refrigeration, warehouses, wholesale markets, and industrial food processing expanded the distance and scale of urban food supply.',
    continueText:'Producer → processing → cold storage → wholesale market → retailer or restaurant.',
    transform:'Food could travel farther and arrive more reliably, while storage, transport labor, and logistical infrastructure became less visible to consumers.',
    tags:['Refrigeration','Warehousing','Regional logistics'],
    progress:'32%'
  },
  telephone:{
    index:'03',
    type:'Mid–late 20th century',
    title:'Telephone ordering',
    text:'Customers called restaurants directly, while staff recorded addresses and coordinated delivery through human communication and local knowledge.',
    continueText:'Customer → restaurant → in-house employee or local rider.',
    transform:'The delivery route remained locally managed, but ordering began to separate the customer from the physical place where food was prepared.',
    tags:['Phone','Local knowledge','Manual dispatch'],
    progress:'55%'
  },
  digital:{
    index:'04',
    type:'2000s–2010s',
    title:'Digital platforms',
    text:'Websites and mobile applications connected customers, restaurants, payments, GPS, menus, ratings, and riders through a single interface.',
    continueText:'Customer app → platform → restaurant → rider → customer.',
    transform:'The interface simplified ordering while platform databases and networked coordination moved more decisions into an invisible digital layer.',
    tags:['Mobile apps','GPS','Platform mediation'],
    progress:'78%'
  },
  algorithmic:{
    index:'05',
    type:'2010s–present',
    title:'Algorithmic dispatch and instant delivery',
    text:'Platforms now use automated assignment, ETA prediction, route optimization, demand forecasting, dynamic pricing, and multi-order coordination.',
    continueText:'Continuous data → prediction → rider positioning → dispatch → route and ETA adjustment.',
    transform:'The system no longer only responds to orders. It predicts and organizes labor, movement, and demand, while presenting the customer with one apparently certain route.',
    tags:['Algorithmic management','ETA prediction','Instant delivery'],
    progress:'100%'
  }
};
const lineageMap=document.getElementById('lineageMap');
const lineageNodes=[...document.querySelectorAll('.lineage-node')];
let lineageActive='local';
let lineageTimer=null;
function setLineage(key,manual=false){
  const data=lineageData[key];
  if(!data||!lineageMap)return;
  lineageActive=key;
  lineageMap.dataset.active=key;
  lineageNodes.forEach(node=>node.classList.toggle('active',node.dataset.lineage===key));
  document.getElementById('lineageDetailIndex').textContent=data.index;
  document.getElementById('lineageDetailType').textContent=data.type;
  document.getElementById('lineageDetailTitle').textContent=data.title;
  document.getElementById('lineageDetailText').textContent=data.text;
  document.getElementById('lineageContinue').textContent=data.continueText;
  document.getElementById('lineageTransform').textContent=data.transform;
  document.getElementById('lineageTags').innerHTML=data.tags.map(tag=>`<span>${tag}</span>`).join('');
  const progress=document.getElementById('lineageProgress');
  if(progress) progress.style.strokeDashoffset=`calc(100 - ${data.progress})`;
  const detail=document.querySelector('.lineage-detail');
  if(detail){detail.classList.remove('is-changing');void detail.offsetWidth;detail.classList.add('is-changing');}
  if(manual) restartLineageCycle();
}
function restartLineageCycle(){
  if(lineageTimer) clearInterval(lineageTimer);
  const order=['local','coldchain','telephone','digital','algorithmic'];
  lineageTimer=setInterval(()=>{
    const next=order[(order.indexOf(lineageActive)+1)%order.length];
    setLineage(next,false);
  },4600);
}
lineageNodes.forEach(node=>{
  node.addEventListener('mouseenter',()=>setLineage(node.dataset.lineage,true));
  node.addEventListener('focus',()=>setLineage(node.dataset.lineage,true));
  node.addEventListener('click',()=>setLineage(node.dataset.lineage,true));
});
if(lineageMap){
  lineageMap.addEventListener('mouseenter',()=>{if(lineageTimer){clearInterval(lineageTimer);lineageTimer=null;}});
  lineageMap.addEventListener('mouseleave',restartLineageCycle);
  const lineageObserver=new IntersectionObserver(entries=>entries.forEach(entry=>{
    if(entry.isIntersecting) restartLineageCycle();
    else if(lineageTimer){clearInterval(lineageTimer);lineageTimer=null;}
  }),{threshold:.35});
  lineageObserver.observe(document.getElementById('s05'));
  setLineage('local',false);
}


// Chapter 06: dynamic community-of-practice map
const communityData={
  forensic:{index:'01',role:'Critical practice · Investigative method',title:'Forensic Architecture',text:'Reconstructs contested events by connecting maps, media, geolocation, models, and timelines into a spatial argument.',approach:'How can distributed and uncertain evidence be spatially reassembled?',position:'A reinterpretation and fork: I translate investigative spatial methods from exceptional events to an everyday delivery system, adding interactive comparison and simulation.',tags:['Multi-source evidence','Geolocation','Uncertainty']},
  data:{index:'02',role:'Critical practice · Ethical framework',title:'Data Feminism',text:'Examines how power shapes data collection, representation, context, and whose labor or experience becomes visible.',approach:'Who is counted, who controls the data, and what knowledge remains absent?',position:'I use this framework to identify power, label data provenance, make labor visible, and avoid treating partial evidence as objective completeness.',tags:['Power','Context','Make labor visible']},
  fairwork:{index:'03',role:'Labor research · Standards',title:'Fairwork',text:'Evaluates platform work through standards for pay, conditions, contracts, management, and worker representation.',approach:'How can platform working conditions be measured through research, worker testimony, and accountable standards?',position:'I share its concern with algorithmic management and worker voice, but translate those questions into spatial comparison and public interaction rather than a platform score.',tags:['Worker interviews','Fair management','Accountability']},
  ldu:{index:'04',role:'Worker knowledge · Organizing',title:'Los Deliveristas Unidos',text:'Organizes app-based delivery workers in New York around pay, safety, infrastructure, education, and collective representation.',approach:'How can delivery workers shape the policies and infrastructures that affect their daily work?',position:'Rider knowledge should inform the project through consent-based observation and participation. I should not treat workers as data sources or speak on their behalf.',tags:['Worker voice','Road safety','Local knowledge']},
  policy:{index:'05',role:'Public accountability · Regulation',title:'NYC DCWP',text:'Regulates delivery-app worker protections, minimum pay, rights notices, and reporting obligations in New York City.',approach:'What information and responsibilities should delivery platforms be required to disclose?',position:'This provides the project’s policy context and potential public data, showing that routes are shaped by law, pay rules, reporting systems, and rights—not only streets.',tags:['Worker rights','Platform reporting','Regulation']},
  platforms:{index:'06',role:'Platform builders · Technical interlocutor',title:'Delivery platforms',text:'Companies such as DoorDash, Uber Eats, and Meituan develop systems for assignment, ETA prediction, routing, demand forecasting, and marketplace optimization.',approach:'How can logistics be predicted and optimized across customers, restaurants, workers, and cities?',position:'They are both technical references and objects of critique. I study their methods while questioning whose time, risk, and knowledge their optimization models prioritize or omit.',tags:['Dispatch','ETA prediction','Optimization']}
};
const communityMap=document.getElementById('communityMap');
const communityNodes=[...document.querySelectorAll('.community-node')];
let communityActive='forensic';
let communityTimer=null;
function setCommunity(key,manual=false){
  const d=communityData[key];
  if(!d||!communityMap)return;
  communityActive=key;
  communityMap.dataset.active=key;
  communityNodes.forEach(node=>node.classList.toggle('active',node.dataset.community===key));
  document.getElementById('communityDetailIndex').textContent=d.index;
  document.getElementById('communityDetailRole').textContent=d.role;
  document.getElementById('communityDetailTitle').textContent=d.title;
  document.getElementById('communityDetailText').textContent=d.text;
  document.getElementById('communityApproach').textContent=d.approach;
  document.getElementById('communityPosition').textContent=d.position;
  document.getElementById('communityTags').innerHTML=d.tags.map(tag=>`<span>${tag}</span>`).join('');
  const detail=document.querySelector('.community-detail');
  if(detail){detail.classList.remove('is-changing');void detail.offsetWidth;detail.classList.add('is-changing');}
  if(manual) restartCommunityCycle();
}
function restartCommunityCycle(){
  if(communityTimer)clearInterval(communityTimer);
  const order=['forensic','data','fairwork','ldu','policy','platforms'];
  communityTimer=setInterval(()=>setCommunity(order[(order.indexOf(communityActive)+1)%order.length],false),4700);
}
communityNodes.forEach(node=>{
  node.addEventListener('mouseenter',()=>setCommunity(node.dataset.community,true));
  node.addEventListener('focus',()=>setCommunity(node.dataset.community,true));
  node.addEventListener('click',()=>setCommunity(node.dataset.community,true));
});
if(communityMap){
  communityMap.addEventListener('mouseenter',()=>{if(communityTimer){clearInterval(communityTimer);communityTimer=null;}});
  communityMap.addEventListener('mouseleave',restartCommunityCycle);
  const communityObserver=new IntersectionObserver(entries=>entries.forEach(entry=>{
    if(entry.isIntersecting)restartCommunityCycle();else if(communityTimer){clearInterval(communityTimer);communityTimer=null;}
  }),{threshold:.35});
  communityObserver.observe(document.getElementById('s06'));
  setCommunity('forensic',false);
}


// Chapter 07: route-logics method diagram
const methodsRouteData={
  shortest:{index:'01 · Quantitative model',title:'Shortest-distance route',text:'Uses the street network to minimize total route length. This establishes a baseline rather than claiming the route a rider would actually choose.',technique:'NetworkX shortest path',data:'OpenStreetMap road graph',metric:'Network distance'},
  fastest:{index:'02 · Quantitative model',title:'Fastest-time route',text:'Weights street segments by estimated cycling time, street class, and intersection delay. It tests how “fastest” differs from simply “shortest.”',technique:'Weighted shortest path',data:'Road class + speed assumptions',metric:'Estimated travel time'},
  bike:{index:'03 · Spatial preference',title:'Bike-lane-priority route',text:'Rewards protected or marked bicycle infrastructure and penalizes segments without bicycle support, even when the resulting route is longer.',technique:'Custom edge weighting',data:'NYC bike lanes + OSM',metric:'Bike-lane coverage'},
  slope:{index:'04 · Embodied cost',title:'Low-slope route',text:'Reduces elevation gain and steep grades to test how physical effort changes route choice across Morningside Heights and West Harlem.',technique:'Elevation-weighted routing',data:'Elevation + street graph',metric:'Elevation gain / grade'},
  risk:{index:'05 · Safety model',title:'Lower-risk route',text:'Penalizes complex intersections and higher-risk street segments. It treats safety as a route cost rather than an invisible externality.',technique:'Risk-weighted routing',data:'Crash + intersection data',metric:'Risk exposure'},
  rider:{index:'06 · Qualitative + modeled',title:'Modeled rider-preferred route',text:'Combines field observations and participant knowledge with spatial costs. Until a rider route is directly observed, it remains explicitly labeled as a model.',technique:'Hybrid evidence model',data:'Field notes + participant account',metric:'Situated preference'}
};
const methodsRouteButtons=[...document.querySelectorAll('[data-method-route]')];
const methodsRoutePaths=[...document.querySelectorAll('[data-route-path]')];
function setMethodsRoute(key){
  const d=methodsRouteData[key];
  if(!d)return;
  methodsRouteButtons.forEach(button=>button.classList.toggle('active',button.dataset.methodRoute===key));
  methodsRoutePaths.forEach(path=>path.classList.toggle('active',path.dataset.routePath===key));
  const ids={
    methodsRouteIndex:d.index,
    methodsRouteTitle:d.title,
    methodsRouteText:d.text,
    methodsRouteTechnique:d.technique,
    methodsRouteData:d.data,
    methodsRouteMetric:d.metric
  };
  Object.entries(ids).forEach(([id,value])=>{const el=document.getElementById(id);if(el)el.textContent=value;});
}
methodsRouteButtons.forEach(button=>{
  button.addEventListener('mouseenter',()=>setMethodsRoute(button.dataset.methodRoute));
  button.addEventListener('focus',()=>setMethodsRoute(button.dataset.methodRoute));
  button.addEventListener('click',()=>setMethodsRoute(button.dataset.methodRoute));
});
methodsRoutePaths.forEach(path=>path.addEventListener('click',()=>setMethodsRoute(path.dataset.routePath)));
setMethodsRoute('shortest');


// Chapter 07: focused mixed-method workflow
const methodOnlyData={
  collect:{
    index:'01 · Data practice',status:'PUBLIC + INTERFACE + FIELD',title:'Collect the evidence',
    description:'Assemble the minimum set of data needed to reconstruct the corridor without pretending that inaccessible platform data is known.',
    inputs:'OpenStreetMap streets; NYC bicycle lanes and crash data; elevation; restaurant and campus entrance coordinates; platform screenshots; field notes.',
    technique:'Source audit, coordinate checking, metadata logging, and evidence classification.',
    output:'A documented source inventory with public, observed, interface, modeled, and missing-data labels.',
    tools:['QGIS','GeoPandas','Field log','Platform capture']
  },
  build:{
    index:'02 · Data processing',status:'SPATIAL NETWORK',title:'Build the street graph',
    description:'Convert the corridor into a directed cycling network and attach the attributes required for later route calculations.',
    inputs:'Street centerlines, directionality, segment length, elevation, bicycle-lane type, intersections, and risk indicators.',
    technique:'Clean geometry, align coordinate systems, create graph edges, and assign transparent edge attributes.',
    output:'An attributed network graph in which every street segment has documented costs and assumptions.',
    tools:['Python','OSMnx','GeoPandas','QGIS']
  },
  generate:{
    index:'03 · Quantitative method',status:'4–6 DISTINCT CANDIDATES',title:'Generate route alternatives',
    description:'Calculate several plausible routes between the same origin and destination rather than presenting one route as universally optimal.',
    inputs:'Attributed street graph plus weights for distance, time, slope, bicycle access, intersection risk, and weather exposure.',
    technique:'K-shortest paths, weighted shortest paths, sensitivity testing, and removal of near-duplicate geometries.',
    output:'Four to six clearly different candidate routes with comparable metrics and stated assumptions.',
    tools:['NetworkX','OSMnx','Pandas','Jupyter']
  },
  ground:{
    index:'04 · Qualitative method',status:'OBSERVE + TIME + DOCUMENT',title:'Ground-truth the corridor',
    description:'Walk or ride the candidate routes to record the conditions that public datasets and platform interfaces fail to describe.',
    inputs:'Candidate route maps, stopwatch, field-note template, camera, restaurant pickup point, and campus handoff point.',
    technique:'Route walk-through or ride-through, timed observation, photography, obstacle logging, and optional consent-based rider accounts.',
    output:'A situated record of waiting, signals, slope, construction, traffic pressure, access, and handoff friction.',
    tools:['Field observation','Photography','Time log','Route notes']
  },
  compare:{
    index:'05 · Mixed-method analysis',status:'METRICS + EXPERIENCE',title:'Compare the evidence',
    description:'Place computed route performance beside observed experience so that numerical efficiency does not erase labor or local knowledge.',
    inputs:'Route length, travel time, elevation gain, bicycle-lane coverage, intersection exposure, field timings, notes, and platform ETA.',
    technique:'Metric matrix, Euclidean-versus-network comparison, predicted-versus-observed comparison, and uncertainty annotation informed by situated technology and critical cartography.',
    output:'A route-by-route evidence table that identifies agreement, conflict, uncertainty, and missing information.',
    tools:['Pandas','Jupyter','D3.js','Critical comparison']
  },
  represent:{
    index:'06 · Design method',status:'INTERACTIVE + VISUAL + MATERIAL',title:'Represent the findings',
    description:'Translate the comparison into forms that let viewers inspect how each route was produced and what kind of evidence supports it.',
    inputs:'Candidate geometries, metrics, field media, source labels, uncertainty ranges, and written interpretation.',
    technique:'Fixed-scale route comparison, one-route-at-a-time interaction, source-coded line styles, layered annotation, and optional tactile translation.',
    output:'An interactive Mapbox/D3 simulator, a route research atlas, and a supporting LED material prototype.',
    tools:['Mapbox GL JS','D3.js','HTML/CSS/JS','Arduino']
  }
};
const methodOnlyButtons=[...document.querySelectorAll('[data-method-step]')];
function setMethodOnlyStep(key){
  const d=methodOnlyData[key];
  if(!d)return;
  methodOnlyButtons.forEach(button=>{
    const active=button.dataset.methodStep===key;
    button.classList.toggle('active',active);
    button.setAttribute('aria-selected',active?'true':'false');
  });
  const values={
    methodOnlyIndex:d.index,
    methodOnlyStatus:d.status,
    methodOnlyTitle:d.title,
    methodOnlyDescription:d.description,
    methodOnlyInputs:d.inputs,
    methodOnlyTechnique:d.technique,
    methodOnlyOutput:d.output
  };
  Object.entries(values).forEach(([id,value])=>{const el=document.getElementById(id);if(el)el.textContent=value;});
  const tools=document.getElementById('methodOnlyTools');
  if(tools)tools.innerHTML=d.tools.map(tool=>`<b>${tool}</b>`).join('');
}
methodOnlyButtons.forEach(button=>{
  button.addEventListener('mouseenter',()=>setMethodOnlyStep(button.dataset.methodStep));
  button.addEventListener('focus',()=>setMethodOnlyStep(button.dataset.methodStep));
  button.addEventListener('click',()=>setMethodOnlyStep(button.dataset.methodStep));
});
if(methodOnlyButtons.length)setMethodOnlyStep('collect');

// Chapters 08–09: aligned method and controlled route experiment
const experimentMethodData={
  case:{
    index:'01 · Controlled case',evidence:'FIXED INPUT',title:'Fix one origin and one destination',
    description:'The restaurant, restaurant pickup entrance, Columbia handoff point, map extent, and transport mode remain unchanged so route differences can be attributed to the calculation conditions.',
    input:'Restaurant coordinate; pickup entrance; Columbia 116th Street gate; cycling mode; fixed study boundary.',
    operation:'Lock the case before changing any route weights or scenario variables.',
    output:'A controlled baseline for comparing every route on the same spatial canvas.',
    tools:['Mapbox','QGIS','Field log']
  },
  network:{
    index:'02 · Network construction',evidence:'PUBLIC + MODELED ATTRIBUTES',title:'Build an attributed street network',
    description:'Street segments become graph edges with the attributes required to calculate more than one definition of route cost.',
    input:'Street geometry, directionality, segment length, estimated cycling time, bicycle infrastructure, elevation, intersections, and restrictions.',
    operation:'Clean the network, align coordinate systems, attach edge attributes, and document which values are measured, sourced, or modeled.',
    output:'A directed street graph in which every segment carries transparent route-cost variables.',
    tools:['OSMnx','GeoPandas','NetworkX','QGIS']
  },
  routes:{
    index:'03 · Candidate generation',evidence:'4–6 STREET-FOLLOWING ROUTES',title:'Generate distinct route candidates',
    description:'The experiment avoids a single “optimal” line by generating several plausible paths between the same two fixed points.',
    input:'Attributed street graph and baseline origin–destination pair.',
    operation:'Use shortest paths, weighted paths, K-shortest paths, corridor constraints, and near-duplicate removal.',
    output:'Four to six street-following alternatives that are spatially different enough to compare.',
    tools:['NetworkX','OSMnx','Mapbox Directions','Jupyter']
  },
  scenarios:{
    index:'04 · Sensitivity test',evidence:'AUTHORED SCENARIO MODEL',title:'Apply changing route costs',
    description:'Traffic, weather, slope sensitivity, bicycle priority, risk sensitivity, and road restriction alter route ranking while the endpoints remain fixed.',
    input:'Candidate routes plus normalized distance, time, slope, bicycle, risk, and exposure metrics.',
    operation:'Change one or more weights, recalculate composite cost, and rank the same route set again.',
    output:'A transparent record of why a different route becomes recommended under each scenario.',
    tools:['Python','Pandas','JavaScript','Sensitivity analysis']
  },
  ground:{
    index:'05 · Situated validation',evidence:'FIELD-OBSERVED',title:'Ground-check the corridor',
    description:'The calculated routes are walked or ridden so that street conditions absent from public data can be documented rather than guessed.',
    input:'Candidate maps, timing sheet, camera, route notes, restaurant pickup point, and campus handoff point.',
    operation:'Time the journey, photograph obstacles, record signals, slope, construction, traffic pressure, waiting, and access friction.',
    output:'Observed evidence that can confirm, complicate, or contradict the route model.',
    tools:['Ride-through','Photography','Time log','Observation']
  },
  compare:{
    index:'06 · Mixed-method comparison',evidence:'MODELED + OBSERVED',title:'Compare results without collapsing them',
    description:'Computed performance and field experience are placed beside one another, with uncertainty and missing platform information kept visible.',
    input:'Distance, moving time, bike support, slope effort, risk exposure, field timing, platform ETA, waiting, and handoff records.',
    operation:'Compare routes on a fixed scale, separate movement from waiting, annotate provenance, and report uncertainty.',
    output:'An interactive experiment showing how each route was produced and what kind of evidence supports it.',
    tools:['Mapbox GL JS','D3.js','HTML/CSS/JS','Critical comparison']
  }
};
const experimentMethodButtons=[...document.querySelectorAll('[data-experiment-method]')];
function setExperimentMethodStep(key){
  const data=experimentMethodData[key];
  if(!data)return;
  experimentMethodButtons.forEach(button=>{
    const active=button.dataset.experimentMethod===key;
    button.classList.toggle('active',active);
    button.setAttribute('aria-selected',active?'true':'false');
  });
  const values={
    experimentMethodIndex:data.index,
    experimentMethodEvidence:data.evidence,
    experimentMethodTitle:data.title,
    experimentMethodDescription:data.description,
    experimentMethodInput:data.input,
    experimentMethodOperation:data.operation,
    experimentMethodOutput:data.output
  };
  Object.entries(values).forEach(([id,value])=>{const element=document.getElementById(id);if(element)element.textContent=value;});
  const tools=document.getElementById('experimentMethodTools');
  if(tools)tools.innerHTML=data.tools.map(tool=>`<b>${tool}</b>`).join('');
}
experimentMethodButtons.forEach(button=>{
  button.addEventListener('mouseenter',()=>setExperimentMethodStep(button.dataset.experimentMethod));
  button.addEventListener('focus',()=>setExperimentMethodStep(button.dataset.experimentMethod));
  button.addEventListener('click',()=>setExperimentMethodStep(button.dataset.experimentMethod));
});
if(experimentMethodButtons.length)setExperimentMethodStep('case');

const routeExperimentOrigin=[-73.95805,40.81575];
const routeExperimentDestination=[-73.96262,40.80784];
const routeExperimentCorridors={
  broadway:[-73.96362,40.81245],
  amsterdam:[-73.95992,40.81188],
  morningside:[-73.95538,40.81152],
  west:[-73.96420,40.81035],
  east:[-73.95478,40.80995]
};
const routeExperimentRoleMeta={
  direct:{name:'Direct network',bike:50,slope:52,risk:52,weather:50,traffic:1.00,description:'A direct platform-style baseline using the cycling network.'},
  broadway:{name:'Broadway corridor',bike:62,slope:28,risk:62,weather:64,traffic:1.18,description:'A lower-slope proxy that accepts heavier avenue exposure.'},
  amsterdam:{name:'Amsterdam corridor',bike:78,slope:43,risk:46,weather:52,traffic:.94,description:'A bicycle-support proxy using the central north–south corridor.'},
  morningside:{name:'Morningside corridor',bike:42,slope:76,risk:38,weather:43,traffic:.82,description:'A quieter-street proxy with greater modeled slope effort.'},
  west:{name:'West-side detour',bike:58,slope:35,risk:54,weather:72,traffic:1.08,description:'A longer western alternative with lower modeled slope but more exposure.'},
  east:{name:'East-side detour',bike:54,slope:67,risk:41,weather:47,traffic:.86,description:'An eastern alternative that trades effort for lower modeled traffic risk.'}
};
const routeExperimentObjectives={
  balanced:{label:'Balanced',distance:1,time:1.15,bike:.9,slope:.8,risk:.9,weather:.55},
  shortest:{label:'Shortest distance',distance:2.7,time:.45,bike:.25,slope:.2,risk:.2,weather:.15},
  fastest:{label:'Fastest time',distance:.45,time:2.7,bike:.3,slope:.3,risk:.25,weather:.25},
  bike:{label:'Bike-lane priority',distance:.55,time:.75,bike:2.8,slope:.45,risk:.55,weather:.35},
  slope:{label:'Low-slope priority',distance:.55,time:.7,bike:.4,slope:2.8,risk:.45,weather:.3},
  risk:{label:'Lower-risk priority',distance:.5,time:.7,bike:.55,slope:.4,risk:2.8,weather:.45}
};
const routeExperimentState={map:null,mapReady:false,routes:[],selectedId:null,recommendedId:null,objective:'balanced',requestSerial:0,abortController:null};
const routeExperimentControls={
  traffic:document.getElementById('experimentTraffic'),
  weather:document.getElementById('experimentWeather'),
  slope:document.getElementById('experimentSlope'),
  bike:document.getElementById('experimentBike'),
  risk:document.getElementById('experimentRisk'),
  wait:document.getElementById('experimentWait'),
  handoff:document.getElementById('experimentHandoff'),
  closure:document.getElementById('experimentClosure')
};
function routeExperimentValues(){
  return {
    traffic:Number(routeExperimentControls.traffic?.value||0),
    weather:Number(routeExperimentControls.weather?.value||0),
    slope:Number(routeExperimentControls.slope?.value||0),
    bike:Number(routeExperimentControls.bike?.value||0),
    risk:Number(routeExperimentControls.risk?.value||0),
    wait:Number(routeExperimentControls.wait?.value||0),
    handoff:Number(routeExperimentControls.handoff?.value||0),
    closure:routeExperimentControls.closure?.value||'none'
  };
}
function routeExperimentSetStatus(text,isError=false){
  const element=document.getElementById('routeExperimentStatus');
  if(element){element.textContent=text;element.classList.toggle('is-error',isError);}
}
function routeExperimentDirectionsUrl(points,alternatives=false){
  const path=points.map(point=>`${point[0]},${point[1]}`).join(';');
  const params=new URLSearchParams({alternatives:String(alternatives),geometries:'geojson',overview:'full',steps:'true',access_token:TOKEN});
  return `https://api.mapbox.com/directions/v5/mapbox/cycling/${path}?${params.toString()}`;
}
async function routeExperimentRequest(points,{role,label,alternatives=false}={}){
  const response=await fetch(routeExperimentDirectionsUrl(points,alternatives),{signal:routeExperimentState.abortController?.signal});
  if(!response.ok)throw new Error(`Directions request failed (${response.status})`);
  const data=await response.json();
  if(data.code!=='Ok'||!Array.isArray(data.routes)||!data.routes.length)throw new Error(data.message||'No street route returned');
  return data.routes.map((route,index)=>({
    id:`${role}-${index}-${Math.random().toString(36).slice(2,7)}`,
    role,
    name:index===0?label:`${label} alternative ${index+1}`,
    coordinates:route.geometry.coordinates,
    distance:route.distance,
    duration:route.duration,
    steps:route.legs?.reduce((sum,leg)=>sum+(leg.steps?.length||0),0)||0,
    source:'Mapbox cycling geometry'
  }));
}
function routeExperimentCentroid(route){
  const points=route.coordinates||[];
  if(!points.length)return [0,0];
  const total=points.reduce((sum,point)=>[sum[0]+point[0],sum[1]+point[1]],[0,0]);
  return [total[0]/points.length,total[1]/points.length];
}
function routeExperimentDuplicate(a,b){
  const ca=routeExperimentCentroid(a),cb=routeExperimentCentroid(b);
  const centroidDistance=Math.hypot(ca[0]-cb[0],ca[1]-cb[1]);
  return Math.abs(a.distance-b.distance)<28&&Math.abs(a.duration-b.duration)<18&&centroidDistance<.00022;
}
function routeExperimentSelectCandidates(batches){
  const all=batches.flat();
  const result=[];
  const roleOrder=['direct','broadway','amsterdam','morningside','west','east'];
  roleOrder.forEach(role=>{
    const candidate=all.find(route=>route.role===role&&!result.some(existing=>routeExperimentDuplicate(existing,route)));
    if(candidate)result.push(candidate);
  });
  all.forEach(route=>{
    if(result.length>=6)return;
    if(!result.some(existing=>routeExperimentDuplicate(existing,route)))result.push(route);
  });
  return result.slice(0,6).map((route,index)=>({...route,id:`experiment-route-${index}`}));
}
function routeExperimentFeatureCollection(){
  const values=routeExperimentValues();
  return {
    type:'FeatureCollection',
    features:routeExperimentState.routes.map(route=>({
      type:'Feature',
      properties:{
        routeId:route.id,
        selected:route.id===routeExperimentState.selectedId,
        recommended:route.id===routeExperimentState.recommendedId,
        blocked:values.closure!=='none'&&route.role===values.closure
      },
      geometry:{type:'LineString',coordinates:route.coordinates}
    }))
  };
}
function routeExperimentNormalize(routes,key){
  const values=routes.map(route=>route.calculated[key]);
  const min=Math.min(...values),max=Math.max(...values);
  routes.forEach(route=>{route.calculated[`n_${key}`]=(route.calculated[key]-min)/Math.max(.0001,max-min);});
}
function routeExperimentCalculate(){
  const values=routeExperimentValues();
  const objective=routeExperimentObjectives[routeExperimentState.objective];
  routeExperimentState.routes.forEach(route=>{
    const meta=routeExperimentRoleMeta[route.role]||routeExperimentRoleMeta.direct;
    const baseMinutes=route.duration/60;
    const trafficDelay=baseMinutes*(values.traffic/100)*.34*meta.traffic;
    const weatherDelay=baseMinutes*(values.weather/100)*.18*(meta.weather/100);
    const moving=baseMinutes+trafficDelay+weatherDelay;
    route.calculated={
      distance:route.distance,
      moving,
      bikePenalty:100-meta.bike,
      bikeSupport:meta.bike,
      slope:meta.slope,
      risk:Math.min(100,meta.risk+Math.max(0,route.steps-10)*.65),
      weather:meta.weather,
      total:moving+values.wait+values.handoff,
      blocked:values.closure!=='none'&&route.role===values.closure
    };
  });
  ['distance','moving','bikePenalty','slope','risk','weather'].forEach(key=>routeExperimentNormalize(routeExperimentState.routes,key));
  routeExperimentState.routes.forEach(route=>{
    const c=route.calculated;
    const score=
      objective.distance*c.n_distance+
      objective.time*c.n_moving+
      objective.bike*c.n_bikePenalty*(values.bike/100)+
      objective.slope*c.n_slope*(values.slope/100)+
      objective.risk*c.n_risk*(values.risk/100)+
      objective.weather*c.n_weather*(values.weather/100)+
      (c.blocked?100:0);
    route.score=score;
  });
  const sorted=[...routeExperimentState.routes].sort((a,b)=>a.score-b.score);
  sorted.forEach((route,index)=>route.rank=index+1);
  routeExperimentState.recommendedId=sorted[0]?.id||null;
}
function routeExperimentUpdateLabels(){
  const values=routeExperimentValues();
  const labels={
    experimentTrafficValue:`${values.traffic}%`,
    experimentWeatherValue:`${values.weather}%`,
    experimentSlopeValue:`${values.slope}%`,
    experimentBikeValue:`${values.bike}%`,
    experimentRiskValue:`${values.risk}%`,
    experimentWaitValue:`${values.wait} min`,
    experimentHandoffValue:`${values.handoff} min`
  };
  Object.entries(labels).forEach(([id,value])=>{const element=document.getElementById(id);if(element)element.textContent=value;});
  const objectiveLabel=document.getElementById('experimentObjectiveLabel');
  if(objectiveLabel)objectiveLabel.textContent=routeExperimentObjectives[routeExperimentState.objective].label;
}
function routeExperimentRenderCards(){
  const container=document.getElementById('routeExperimentCards');
  if(!container)return;
  if(!routeExperimentState.routes.length){container.innerHTML='<div class="route-experiment-card"><strong>No routes available</strong><small>Check routing access</small></div>';return;}
  container.innerHTML=routeExperimentState.routes.map(route=>{
    const meta=routeExperimentRoleMeta[route.role]||routeExperimentRoleMeta.direct;
    const classes=['route-experiment-card'];
    if(route.id===routeExperimentState.selectedId)classes.push('selected');
    if(route.id===routeExperimentState.recommendedId)classes.push('recommended');
    if(route.calculated?.blocked)classes.push('blocked');
    return `<button type="button" class="${classes.join(' ')}" data-experiment-route-id="${route.id}"><strong>${meta.name}</strong><span>#${route.rank} · ${(route.distance/1000).toFixed(2)} km</span><small>${route.calculated?.blocked?'restricted corridor':`${Math.round(route.calculated.moving)} min moving · score ${route.score.toFixed(2)}`}</small></button>`;
  }).join('');
  container.querySelectorAll('[data-experiment-route-id]').forEach(button=>button.addEventListener('click',()=>routeExperimentSelectRoute(button.dataset.experimentRouteId,false)));
}
function routeExperimentInterpretation(route){
  if(!route)return 'Route data is unavailable.';
  const objective=routeExperimentObjectives[routeExperimentState.objective].label.toLowerCase();
  const meta=routeExperimentRoleMeta[route.role]||routeExperimentRoleMeta.direct;
  const values=routeExperimentValues();
  const blocked=route.calculated.blocked?' It is currently penalized by the selected road restriction.':'';
  return `${meta.name} ranks #${route.rank} under the ${objective} objective. ${meta.description}${blocked} Restaurant waiting and campus handoff are added to total delivery time but do not redraw the street route.`;
}
function routeExperimentUpdateMetrics(){
  const route=routeExperimentState.routes.find(item=>item.id===routeExperimentState.selectedId)||routeExperimentState.routes.find(item=>item.id===routeExperimentState.recommendedId);
  const values=routeExperimentValues();
  if(!route)return;
  const meta=routeExperimentRoleMeta[route.role]||routeExperimentRoleMeta.direct;
  const data={
    experimentSelectedName:meta.name,
    experimentRouteLogic:route.id===routeExperimentState.recommendedId?`Recommended · rank 1/${routeExperimentState.routes.length}`:`Alternative · rank ${route.rank}/${routeExperimentState.routes.length}`,
    experimentDistance:`${(route.distance/1000).toFixed(2)} km`,
    experimentMoveTime:`${Math.round(route.calculated.moving)} min`,
    experimentBikeCoverage:`${meta.bike}%`,
    experimentSlopeCost:`${meta.slope}/100`,
    experimentRiskMetric:`${Math.round(route.calculated.risk)}/100`,
    experimentTotalTime:`${Math.round(route.calculated.total)} min`,
    experimentMovingLabel:`${Math.round(route.calculated.moving)} min`,
    experimentWaitLabel:`${values.wait} min`,
    experimentHandoffLabel:`${values.handoff} min`,
    experimentInterpretation:routeExperimentInterpretation(route)
  };
  Object.entries(data).forEach(([id,value])=>{const element=document.getElementById(id);if(element)element.textContent=value;});
  const total=Math.max(1,route.calculated.total);
  const segments={
    experimentMovingSegment:route.calculated.moving/total*100,
    experimentWaitSegment:values.wait/total*100,
    experimentHandoffSegment:values.handoff/total*100
  };
  Object.entries(segments).forEach(([id,width])=>{const element=document.getElementById(id);if(element)element.style.width=`${width}%`;});
}
function routeExperimentUpdateMap(fit=false){
  if(!routeExperimentState.mapReady)return;
  const source=routeExperimentState.map.getSource('route-experiment-routes');
  if(source)source.setData(routeExperimentFeatureCollection());
  if(fit&&routeExperimentState.routes.length){
    const bounds=new mapboxgl.LngLatBounds();
    routeExperimentState.routes.forEach(route=>route.coordinates.forEach(coordinate=>bounds.extend(coordinate)));
    routeExperimentState.map.fitBounds(bounds,{padding:{top:55,right:55,bottom:55,left:55},duration:700,maxZoom:15.8});
  }
}
function routeExperimentSelectRoute(id,fromMap=false){
  if(!routeExperimentState.routes.some(route=>route.id===id))return;
  routeExperimentState.selectedId=id;
  routeExperimentRenderCards();
  routeExperimentUpdateMetrics();
  routeExperimentUpdateMap(false);
  if(fromMap)routeExperimentSetStatus('Selected a route directly from the map.');
}
function routeExperimentUpdateModel(autoSelect=true){
  if(!routeExperimentState.routes.length){routeExperimentUpdateLabels();return;}
  routeExperimentCalculate();
  if(autoSelect||!routeExperimentState.routes.some(route=>route.id===routeExperimentState.selectedId))routeExperimentState.selectedId=routeExperimentState.recommendedId;
  routeExperimentUpdateLabels();
  routeExperimentRenderCards();
  routeExperimentUpdateMetrics();
  routeExperimentUpdateMap(false);
}
async function routeExperimentFetchRoutes(){
  if(!document.getElementById('routeExperimentMap'))return;
  const serial=++routeExperimentState.requestSerial;
  routeExperimentState.abortController?.abort();
  routeExperimentState.abortController=new AbortController();
  routeExperimentSetStatus('Calculating street-following alternatives…');
  document.getElementById('routeExperimentFallback')?.classList.remove('is-hidden');
  try{
    const requests=[
      routeExperimentRequest([routeExperimentOrigin,routeExperimentDestination],{role:'direct',label:'Direct network',alternatives:true}),
      routeExperimentRequest([routeExperimentOrigin,routeExperimentCorridors.broadway,routeExperimentDestination],{role:'broadway',label:'Broadway corridor'}),
      routeExperimentRequest([routeExperimentOrigin,routeExperimentCorridors.amsterdam,routeExperimentDestination],{role:'amsterdam',label:'Amsterdam corridor'}),
      routeExperimentRequest([routeExperimentOrigin,routeExperimentCorridors.morningside,routeExperimentDestination],{role:'morningside',label:'Morningside corridor'}),
      routeExperimentRequest([routeExperimentOrigin,routeExperimentCorridors.west,routeExperimentDestination],{role:'west',label:'West-side detour'}),
      routeExperimentRequest([routeExperimentOrigin,routeExperimentCorridors.east,routeExperimentDestination],{role:'east',label:'East-side detour'})
    ];
    const settled=await Promise.allSettled(requests);
    if(serial!==routeExperimentState.requestSerial)return;
    const batches=settled.filter(result=>result.status==='fulfilled').map(result=>result.value);
    if(!batches.length)throw settled.find(result=>result.status==='rejected')?.reason||new Error('No route request succeeded');
    routeExperimentState.routes=routeExperimentSelectCandidates(batches);
    if(!routeExperimentState.routes.length)throw new Error('No distinct route alternatives returned');
    routeExperimentCalculate();
    routeExperimentState.selectedId=routeExperimentState.recommendedId;
    routeExperimentUpdateLabels();
    routeExperimentRenderCards();
    routeExperimentUpdateMetrics();
    routeExperimentUpdateMap(true);
    routeExperimentSetStatus(`${routeExperimentState.routes.length} fixed-endpoint routes ready`);
    document.getElementById('routeExperimentFallback')?.classList.add('is-hidden');
  }catch(error){
    if(error.name==='AbortError')return;
    routeExperimentState.routes=[];
    routeExperimentState.selectedId=null;
    routeExperimentRenderCards();
    routeExperimentSetStatus(`${error.message}. No invented street route has been substituted.`,true);
    const fallback=document.getElementById('routeExperimentFallback');
    if(fallback){
      fallback.classList.remove('is-hidden');
      const title=fallback.querySelector('strong');
      const note=fallback.querySelector('span');
      if(title)title.textContent='Routing unavailable';
      if(note)note.textContent='Check network access or the Mapbox token. The experiment keeps the limitation visible rather than drawing schematic streets as real routes.';
    }
  }
}
function routeExperimentMarker(letter,className=''){
  const element=document.createElement('div');
  element.className=`route-experiment-marker ${className}`.trim();
  element.textContent=letter;
  return element;
}
function routeExperimentInitMap(){
  const container=document.getElementById('routeExperimentMap');
  if(!container)return;
  if(!window.mapboxgl){routeExperimentSetStatus('Mapbox GL JS did not load.',true);return;}
  mapboxgl.accessToken=TOKEN;
  routeExperimentState.map=new mapboxgl.Map({
    container:'routeExperimentMap',
    style:'mapbox://styles/mapbox/dark-v11',
    center:[-73.9602,40.8117],
    zoom:14.4,
    pitch:22,
    bearing:-8,
    attributionControl:false
  });
  routeExperimentState.map.addControl(new mapboxgl.NavigationControl({showCompass:false}),'top-right');
  routeExperimentState.map.on('load',()=>{
    routeExperimentState.mapReady=true;
    routeExperimentState.map.addSource('route-experiment-routes',{type:'geojson',data:{type:'FeatureCollection',features:[]}});
    routeExperimentState.map.addLayer({id:'route-experiment-base',type:'line',source:'route-experiment-routes',paint:{'line-color':'#8f8f8f','line-width':4,'line-opacity':.48}});
    routeExperimentState.map.addLayer({id:'route-experiment-blocked',type:'line',source:'route-experiment-routes',filter:['==',['get','blocked'],true],paint:{'line-color':'#ffb000','line-width':5,'line-opacity':.82,'line-dasharray':[1.2,1.2]}});
    routeExperimentState.map.addLayer({id:'route-experiment-recommended',type:'line',source:'route-experiment-routes',filter:['==',['get','recommended'],true],paint:{'line-color':'#ffffff','line-width':5,'line-opacity':.9,'line-dasharray':[2,1.4]}});
    routeExperimentState.map.addLayer({id:'route-experiment-selected',type:'line',source:'route-experiment-routes',filter:['==',['get','selected'],true],paint:{'line-color':'#ff3348','line-width':7,'line-opacity':.98}});
    routeExperimentState.map.addLayer({id:'route-experiment-hit',type:'line',source:'route-experiment-routes',paint:{'line-color':'rgba(0,0,0,0)','line-width':18}});
    routeExperimentState.map.on('mouseenter','route-experiment-hit',()=>routeExperimentState.map.getCanvas().style.cursor='pointer');
    routeExperimentState.map.on('mouseleave','route-experiment-hit',()=>routeExperimentState.map.getCanvas().style.cursor='');
    routeExperimentState.map.on('click','route-experiment-hit',event=>{
      const id=event.features?.[0]?.properties?.routeId;
      if(id)routeExperimentSelectRoute(id,true);
    });
    new mapboxgl.Marker({element:routeExperimentMarker('R')}).setLngLat(routeExperimentOrigin).addTo(routeExperimentState.map);
    new mapboxgl.Marker({element:routeExperimentMarker('C','destination')}).setLngLat(routeExperimentDestination).addTo(routeExperimentState.map);
    routeExperimentFetchRoutes();
  });
  routeExperimentState.map.on('error',()=>routeExperimentSetStatus('Map style or routing service unavailable.',true));
  const slide=document.getElementById('s09');
  if(slide){
    const resizeObserver=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting)setTimeout(()=>routeExperimentState.map?.resize(),120);}),{threshold:.2});
    resizeObserver.observe(slide);
  }
}
[...document.querySelectorAll('[data-experiment-objective]')].forEach(button=>button.addEventListener('click',()=>{
  routeExperimentState.objective=button.dataset.experimentObjective;
  document.querySelectorAll('[data-experiment-objective]').forEach(item=>item.classList.toggle('active',item===button));
  routeExperimentUpdateModel(true);
}));
['traffic','weather','slope','bike','risk','wait','handoff'].forEach(key=>routeExperimentControls[key]?.addEventListener('input',()=>routeExperimentUpdateModel(true)));
routeExperimentControls.closure?.addEventListener('change',()=>routeExperimentUpdateModel(true));
routeExperimentUpdateLabels();
routeExperimentInitMap();

// Chapter 07 — visual representation modes
const visualRepresentationModes={
  layer:{title:'Layer the route',caption:'Begin with the familiar route line, then open spatial conditions, labor friction, and the wider digital system behind it.'},
  compare:{title:'Compare route logics',caption:'Hold the origin, destination, scale, and map frame constant so differences come from route priorities rather than graphic composition.'},
  disclose:{title:'Disclose the evidence',caption:'Keep public, observed, modeled, inferred, and missing information visually distinct instead of presenting equal certainty.'}
};
const visualRepresentationStage=document.getElementById('visualRepresentationStage');
document.querySelectorAll('[data-visual-mode]').forEach(button=>button.addEventListener('click',()=>{
  const mode=button.dataset.visualMode;
  document.querySelectorAll('[data-visual-mode]').forEach(item=>item.classList.toggle('active',item===button));
  visualRepresentationStage?.classList.remove('mode-layer','mode-compare','mode-disclose');
  visualRepresentationStage?.classList.add(`mode-${mode}`);
  const data=visualRepresentationModes[mode];
  const title=document.getElementById('visualRepresentationTitle');
  const caption=document.getElementById('visualRepresentationCaption');
  if(title)title.textContent=data.title;
  if(caption)caption.textContent=data.caption;
}));

// Chapter 07 — rhetorical argument factors
const argumentFactors={
  time:{label:'Time',text:'Platform ETA often foregrounds moving time while restaurant waiting and campus handoff delay remain less visible.'},
  safety:{label:'Safety',text:'The shortest or fastest route may transfer more traffic exposure and intersection risk to the rider.'},
  infrastructure:{label:'Infrastructure',text:'Bike lanes, signals, slope, road restrictions, and campus access shape which paths are practically available.'},
  labor:{label:'Labor',text:'Rider judgment and bodily effort help make the route work, even when those decisions are absent from the customer interface.'},
  data:{label:'Data',text:'A route appears precise only because uncertainty, missing platform data, and conflicting evidence have been compressed or omitted.'}
};
document.querySelectorAll('[data-argument-factor]').forEach(button=>button.addEventListener('click',()=>{
  const key=button.dataset.argumentFactor;
  document.querySelectorAll('[data-argument-factor]').forEach(item=>item.classList.toggle('active',item===button));
  const label=document.getElementById('argumentFactorLabel');
  const text=document.getElementById('argumentFactorText');
  if(label)label.textContent=argumentFactors[key].label;
  if(text)text.textContent=argumentFactors[key].text;
}));

// Chapter 07 — provisional capstone forms
const capstoneComponents={
  software:{type:'Potential form 01 · Live interface',title:'Interactive route simulator',text:'A map-based interface where viewers compare multiple routes between the same origin and destination, change traffic, weather, slope, bike-lane, and risk priorities, and see the source and limits of each modeled result.'},
  archive:{type:'Potential form 02 · Evidence layer',title:'Situated route archive',text:'A research archive that connects every route to field photographs, time logs, platform screenshots, public datasets, validation notes, uncertainty, and evidence that remains unavailable.'}
};
document.querySelectorAll('[data-capstone-component]').forEach(button=>button.addEventListener('click',()=>{
  const key=button.dataset.capstoneComponent;
  document.querySelectorAll('[data-capstone-component]').forEach(item=>item.classList.toggle('active',item===button));
  const data=capstoneComponents[key];
  document.getElementById('capstoneComponentType').textContent=data.type;
  document.getElementById('capstoneComponentTitle').textContent=data.title;
  document.getElementById('capstoneComponentText').textContent=data.text;
}));

// Chapter 07 — challenge gap-to-plan cards
const challengeDetails={
  data:{number:'Challenge 01',title:'Data and access',gap:'Platform dispatch logic, historical rider traces, pricing rules, and performance data are not publicly available.',plan:'Maintain a strict evidence protocol, document missing data, and never present authored simulations as platform facts.',honesty:'The project can reconstruct public street conditions, but it cannot yet claim to reproduce real platform decision-making.'},
  validation:{number:'Challenge 02',title:'Validation and participation',gap:'Modeled route alternatives do not yet demonstrate how riders actually judge safety, effort, waiting, or local shortcuts.',plan:'Conduct route walk-throughs or ride-throughs, record changing street conditions, and seek consent-based conversations with riders or labor researchers.',honesty:'My knowledge of platform interfaces and spatial data is currently stronger than my direct knowledge of riders’ everyday experience.'},
  technical:{number:'Challenge 03',title:'Technical development',gap:'The prototype needs stronger weighted-network analysis, route diversity checks, elevation data, uncertainty handling, and reproducible validation.',plan:'Build the model incrementally in Jupyter, preserve simple baseline routes, test each variable independently, and avoid an opaque optimization black box.',honesty:'My current Python, GIS, and Mapbox skills support a functional prototype, but the analytical model still requires substantial refinement.'},
  visual:{number:'Challenge 04',title:'Visual clarity and scope',gap:'Many routes, metrics, evidence types, and interface layers can quickly become an unreadable spaghetti map or an overextended research agenda.',plan:'Keep one route active at a time, use a fixed map frame, test the visual grammar with viewers, and maintain one fixed origin and destination.',honesty:'The visual system is developing; clarity and evidence must take priority over adding more features or more territory.'}
};
document.querySelectorAll('[data-challenge]').forEach(button=>button.addEventListener('click',()=>{
  const key=button.dataset.challenge;
  document.querySelectorAll('[data-challenge]').forEach(item=>item.classList.toggle('active',item===button));
  const data=challengeDetails[key];
  document.getElementById('challengeNumber').textContent=data.number;
  document.getElementById('challengeTitle').textContent=data.title;
  document.getElementById('challengeGap').textContent=data.gap;
  document.getElementById('challengePlan').textContent=data.plan;
  document.getElementById('challengeHonesty').textContent=data.honesty;
}));
