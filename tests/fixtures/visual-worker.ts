// Local visual QA only. This entrypoint is never imported by the production build.
import app,{ type RuntimeEnv } from '../../src/worker';
import type { EvidenceManifest } from '../../src/shared/schemas/evidenceManifest';
import design from './schemas/design-system-version.valid.json';
const realFetch = globalThis.fetch;
globalThis.fetch = async (input: RequestInfo | URL,init?: RequestInit) => {
  if (String(input) !== 'https://api.openai.com/v1/responses') return realFetch(input,init);
  const body = JSON.parse(init!.body as string),stage = body.text.format.name;
  const text = body.input[0].content[0].text as string;
  const data = JSON.parse(text.split('\nReviewed components:')[0]);
  const pages = (data.pages || [data.page]) as EvidenceManifest['pages'];
  const reference = { pageId: pages[0].id,regionId: pages[0].regions[0].id,sourceId: pages[0].content[0].id };
  const value = stage === 'reframe_evaluate' ? { summary: 'Visual QA fixture: a cosmic identity worth preserving, with navigation and readability ready for a new chapter.',findings: ['navigation','readability','responsiveness','preservation'].map((category,index) => ({ id: `finding-${index}`,category,title: ['Make the universe easier to explore','Give the content room to breathe','Let the layout adapt to each screen','Keep the original story intact'][index],description: 'Test-only recommendation for checking card layout and evidence interactions. This is not a live AI evaluation.',severity: 'opportunity',observedVsInferred: 'inferred',evidenceRefs: [reference] })) }
    : stage === 'reframe_decompose' ? { components: pages.flatMap(page => page.regions.filter(region => region.sourceIds.length).slice(0,4).map((region,index) => ({ stableId: `${page.id}-${index}`,sourcePageId: page.id,semanticRole: index ? 'navigation' : 'brand',reusableGroupId: index ? 'navigation' : 'brand',label: region.label || `Source region ${index + 1}`,sourceIds: region.sourceIds,regionId: region.id,recommendation: 'rebuild',note: 'Visual QA fixture. Preserve this original region while changing its presentation.' }))) }
    : stage === 'reframe_design_system' ? { name: 'Cosmic Archive · visual test fixture',tokens: { ...design.tokens,colors: { background: '#f8f5ee',surface: '#fffdf8',text: '#22203b',muted: '#666078',primary: '#5d40b9',accent: '#c96121',border: '#dfd9e9' },typography: { ...design.tokens.typography,headingFont: 'Space Grotesk' } },componentStyles: design.componentStyles,evidenceRationale: [{ decision: 'Test palette echoes the original cosmic imagery, with a warm editorial surface.',evidenceRefs: [reference] }] }
    : { sections: [{ id: 'hero',kind: 'hero',sourceIds: pages[0].content.filter(item => item.kind === 'image').slice(0,1).map(item => item.id),layout: 'wide',emphasis: 'accent' },{ id: 'navigation',kind: 'card_grid',sourceIds: pages[0].content.filter(item => item.kind === 'link').map(item => item.id),layout: 'grid',emphasis: 'normal' },{ id: 'archive',kind: 'gallery',sourceIds: pages[0].content.filter(item => item.kind !== 'link').map(item => item.id),layout: 'grid',emphasis: 'quiet' }].filter(section => section.sourceIds.length) };
  return Response.json({ status: 'completed',output: [{ content: [{ type: 'output_text',text: JSON.stringify(value) }] }],usage: { input_tokens: 0,output_tokens: 0 } });
};
export default { async fetch(request: Request,env: RuntimeEnv) {
  if (new URL(request.url).hostname !== '127.0.0.1') return new Response('Local test only',{ status: 403 });
  const response = await app.fetch(request,env,{ waitUntil() {} });
  if (new URL(request.url).pathname === '/api/config/status') return Response.json({ ...await response.json() as object,visualFixture: true });
  return response;
} };
