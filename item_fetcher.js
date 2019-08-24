import timeline from './family_timeline.json';
onmessage = function(_event) {
  postMessage({ items: timeline });
}