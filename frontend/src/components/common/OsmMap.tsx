import React, { useEffect, useMemo, useRef } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';

// The package's bundled typings clash with this React/TypeScript version (every prop resolves to `never`).
const NativeWebView = WebView as unknown as React.ComponentType<any>;

interface Props {
  latitude?: number | null;
  longitude?: number | null;
  /** When true the user can tap or drag the marker; otherwise it is a read-only preview. */
  interactive?: boolean;
  onPick?: (lat: number, lng: number) => void;
  height?: number;
  /** Stretch to the parent instead of using a fixed height. */
  fill?: boolean;
  /** Zoom used when a pin exists. */
  zoom?: number;
  /** Where to look when there is no pin yet (e.g. the middle of the chosen district). */
  center?: { lat: number; lng: number; zoom?: number } | null;
}

const hasPin = (lat?: number | null, lng?: number | null): lat is number => lat != null && lng != null;

/**
 * An OpenStreetMap map (Leaflet inside a WebView; an iframe on web). It needs no API key, works in Expo Go,
 * and shows a marker that the user can move when `interactive`.
 */
export const OsmMap: React.FC<Props> = ({ latitude, longitude, interactive = false, onPick, height = 220, fill = false, zoom = 16, center }) => {
  const webRef = useRef<any>(null);
  const frameRef = useRef<any>(null);
  const pin = hasPin(latitude, longitude);

  // The page is built once: later position changes are sent into it, so the map never reloads or flickers.
  const html = useMemo(
    () =>
      buildHtml({
        lat: pin ? (latitude as number) : center ? center.lat : 20,
        lng: pin ? (longitude as number) : center ? center.lng : 0,
        zoom: pin ? zoom : center ? (center.zoom ?? 12) : 2,
        pin,
        interactive,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const move = (lat: number, lng: number) => {
    const js = `window.__move && window.__move(${lat}, ${lng}, ${zoom}); true;`;
    if (Platform.OS === 'web') {
      frameRef.current?.contentWindow?.postMessage(JSON.stringify({ type: 'move', lat, lng, zoom }), '*');
    } else {
      webRef.current?.injectJavaScript(js);
    }
  };

  useEffect(() => {
    if (pin) move(latitude as number, longitude as number);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latitude, longitude]);

  const handle = (raw: string) => {
    try {
      const msg = JSON.parse(raw);
      if (msg.type === 'pin' && onPick) onPick(Number(msg.lat), Number(msg.lng));
    } catch {
      /* not ours */
    }
  };

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const listener = (e: MessageEvent) => {
      if (e.source === frameRef.current?.contentWindow && typeof e.data === 'string') handle(e.data);
    };
    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onPick]);

  return (
    <View style={[styles.wrap, fill ? { flex: 1 } : { height }]}>
      {Platform.OS === 'web'
        ? React.createElement('iframe', {
            ref: frameRef,
            srcDoc: html,
            title: interactive ? 'Pick a location on the map' : 'Map',
            'data-testid': interactive ? 'map-picker' : 'map-preview',
            style: { border: 'none', width: '100%', height: '100%' },
          })
        : (
          <NativeWebView
            ref={webRef}
            originWhitelist={['*']}
            source={{ html }}
            onMessage={(e: WebViewMessageEvent) => handle(e.nativeEvent.data)}
            javaScriptEnabled
            domStorageEnabled
            scrollEnabled={false}
            nestedScrollEnabled
            startInLoadingState
            style={styles.web}
          />
        )}
    </View>
  );
};

function buildHtml(cfg: { lat: number; lng: number; zoom: number; pin: boolean; interactive: boolean }): string {
  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>html,body,#map{height:100%;margin:0;background:#e8eef0}.leaflet-container{font-family:sans-serif}</style></head>
<body><div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
(function(){
  var cfg = ${JSON.stringify(cfg)};
  var map = L.map('map').setView([cfg.lat, cfg.lng], cfg.zoom);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom: 19, attribution: '&copy; OpenStreetMap'}).addTo(map);
  var marker = null;
  function send(o){
    var s = JSON.stringify(o);
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(s); else window.parent.postMessage(s, '*');
  }
  function ensureMarker(lat, lng){
    if (!marker) {
      marker = L.marker([lat, lng], {draggable: cfg.interactive}).addTo(map);
      if (cfg.interactive) marker.on('dragend', function(){ var p = marker.getLatLng(); send({type:'pin', lat:p.lat, lng:p.lng}); });
    } else { marker.setLatLng([lat, lng]); }
  }
  if (cfg.pin) ensureMarker(cfg.lat, cfg.lng);
  if (cfg.interactive) {
    map.on('click', function(e){ ensureMarker(e.latlng.lat, e.latlng.lng); send({type:'pin', lat:e.latlng.lat, lng:e.latlng.lng}); });
  }
  // The app moves the marker / view (postal-code result, GPS fix) without reloading the page.
  window.__move = function(lat, lng, zoom){
    ensureMarker(lat, lng);
    map.setView([lat, lng], Math.max(map.getZoom(), zoom || 15));
  };
  window.addEventListener('message', function(ev){
    try { var m = JSON.parse(ev.data); if (m.type === 'move') window.__move(m.lat, m.lng, m.zoom); } catch(e) {}
  });
})();
</script></body></html>`;
}

const styles = StyleSheet.create({
  wrap: { width: '100%', borderRadius: 14, overflow: 'hidden', backgroundColor: '#E8EEF0' },
  web: { flex: 1, backgroundColor: 'transparent' },
});
