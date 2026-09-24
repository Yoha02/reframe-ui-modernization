import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { parse, type DefaultTreeAdapterMap } from 'parse5';
import { zipSync } from 'fflate';
import { EvidenceManifestSchema, type EvidenceManifest } from '../src/shared/schemas/evidenceManifest';
type Node = DefaultTreeAdapterMap['node'];
type Element = DefaultTreeAdapterMap['element'];
export const computeSha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const clean = (text: string) => text.replace(/\s+/g,' ').trim();
function children(node: Node): Node[] { return 'childNodes' in node ? node.childNodes : []; }
function attr(node: Node,key: string) { return 'attrs' in node ? node.attrs.find(a => a.name === key)?.value : undefined; }
function text(node: Node): string {
  if ('tagName' in node && ['script','style','head'].includes(node.tagName)) return '';
  return 'value' in node ? node.value : children(node).map(text).join(' ');
}
function descendants(node: Node): Element[] { return children(node).flatMap(child => [...('tagName' in child ? [child] : []),...descendants(child)]); }
interface RawPage { title: string; source_url: string; frame_wrapper_url: string | null; source_file: string; screenshot_file: string; capture_metadata_file: string; assets: { source_url: string; file: string; content_type: string; original_name: string }[]; }
interface Capture { viewport: { width: number; height: number }; screenshot: { width: number; height: number }; elements: { id: string; tag: string; text: string; src: string | null; href: string | null; bounds: { x: number; y: number; width: number; height: number } }[]; }
export async function buildEvidenceManifest(input: string, output: string) {
  const inventory = JSON.parse(await readFile(resolve(input,'source-inventory.json'),'utf8')) as { collected_at: string; pages: RawPage[] };
  const files: Record<string,Uint8Array> = {};
  const manifest: EvidenceManifest = { schemaVersion: 1,title: 'Space Jam 1996',sourceUrl: inventory.pages[0].source_url,
    provenance: { capturedAt: inventory.collected_at,method: 'prepared_browser_capture',tool: 'Codex browser capture + offline manifest preparation' },assets: [],pages: [] };
  async function include(original: string,target: string,mediaType: string) {
    const bytes = new Uint8Array(await readFile(resolve(input,original))); files[target] = bytes;
    return { objectKey: target,sha256: computeSha256(bytes),mediaType,byteSize: bytes.byteLength,immutable: true };
  }
  for (const [i,page] of inventory.pages.entries()) {
    const id = ['home','the-lineup','jam-central'][i];
    const meta = JSON.parse(await readFile(resolve(input,page.capture_metadata_file),'utf8')) as Capture;
    const html = await include(page.source_file,`pages/${id}/source.html`,'text/html');
    const screenshot = await include(page.screenshot_file,`screenshots/${id}.jpg`,'image/jpeg');
    const doc = parse(new TextDecoder().decode(files[html.objectKey]),{ scriptingEnabled: false });
    const elements = descendants(doc);
    const warnings = ['Legacy HTML is stored as inert evidence and is never executed.','Screenshot records a viewport, not the entire scrollable page.'];
    for (const asset of page.assets.filter(asset => asset.content_type.startsWith('image/'))) {
      if (manifest.assets.some(item => item.sourceUrl === asset.source_url)) continue;
      const assetId = `asset-${manifest.assets.length}`;
      const file = await include(asset.file,`assets/${assetId}.${asset.original_name.split('.').pop()}`,asset.content_type);
      const source = elements.find(el => attr(el,'src') && new URL(attr(el,'src')!,page.source_url).href === asset.source_url);
      manifest.assets.push({ id: assetId,sourceUrl: asset.source_url,originalPath: asset.original_name,file,alt: source ? attr(source,'alt') ?? asset.original_name : asset.original_name });
    }
    const content: EvidenceManifest['pages'][number]['content'] = [];
    const links: EvidenceManifest['pages'][number]['links'] = [];
    for (const [index,element] of meta.elements.entries()) {
      const sourceId = `${id}-${element.id}`;
      const asset = manifest.assets.find(item => item.sourceUrl === element.src);
      if (element.tag === 'img' && asset) content.push({ id: sourceId,kind: 'image',text: element.text || asset.alt,assetId: asset.id });
      if (element.href) {
        const anchor = elements.filter(el => ['a','area'].includes(el.tagName)).find(el => attr(el,'href') && new URL(attr(el,'href')!,page.source_url).href === element.href);
        const childImage = anchor && descendants(anchor).find(el => el.tagName === 'img');
        const label = clean(element.text || (anchor && attr(anchor,'alt')) || (childImage && attr(childImage,'alt')) ||
          (meta.elements[index + 1]?.tag === 'img' ? meta.elements[index + 1].text : '') || new URL(element.href).pathname.split('/').pop()?.replace(/\.(html?|gif)$/i,'') || 'Original link');
        links.push({ id: sourceId,label,href: element.href,origin: element.tag === 'area' ? 'image_map' : 'anchor' });
        content.push({ id: sourceId,kind: 'link',text: label,href: element.href });
      }
    }
    const body = elements.find(el => el.tagName === 'body') ?? doc;
    const sourceText = clean(text(body));
    // Preserve text verbatim as evidence. The renderer resolves these references; AI cannot invent replacement copy.
    if (sourceText.length > 12000) throw new Error('Split long source text into bounded blocks before preparing this bundle.');
    if (sourceText) content.push({ id: `${id}-body-text`,kind: /copyright|©/i.test(sourceText) ? 'copyright' : 'paragraph',text: sourceText });
    const regions = meta.elements.flatMap(element => {
      const source = content.find(item => item.id === `${id}-${element.id}`);
      const { width,height } = meta.viewport; const b = element.bounds;
      const x = Math.max(0,b.x), y = Math.max(0,b.y), w = Math.min(width,b.x + b.width) - x, h = Math.min(height,b.y + b.height) - y;
      if (!source || w <= 1 || h <= 1) return [];
      return [{ id: `${id}-region-${element.id}`,label: source.text || source.kind,role: source.kind,x,y,width: w,height: h,sourceIds: [source.id],...(source.assetId ? { assetId: source.assetId } : {}) }];
    });
    for (const element of elements.filter(el => el.tagName === 'img' && attr(el,'src'))) {
      const url = new URL(attr(element,'src')!,page.source_url).href;
      if (!manifest.assets.some(asset => asset.sourceUrl === url)) warnings.push(`Missing captured image: ${url}`);
    }
    const frames = page.frame_wrapper_url ? [{ sourceUrl: page.source_url,parentUrl: page.frame_wrapper_url,contentPageId: id,depth: 1 }] : [];
    manifest.pages.push({ id,title: page.title,route: i === 0 ? '/' : `/${id}/`,sourceUrl: page.source_url,html,screenshot,text: sourceText,
      viewport: { width: meta.viewport.width,height: meta.viewport.height,screenshotWidth: meta.screenshot.width,screenshotHeight: meta.screenshot.height },content,links,regions,frames,warnings });
    for (const [name,value] of Object.entries({ text: sourceText,links,assets: manifest.assets.filter(asset => page.assets.some(raw => raw.source_url === asset.sourceUrl)),frames })) {
      files[`pages/${id}/${name}.${name === 'text' ? 'txt' : 'json'}`] = new TextEncoder().encode(typeof value === 'string' ? value : JSON.stringify(value,null,2));
    }
  }
  const validated = EvidenceManifestSchema.parse(manifest);
  files['evidence-manifest.json'] = new TextEncoder().encode(JSON.stringify(validated,null,2));
  files['provenance.json'] = new TextEncoder().encode(JSON.stringify({ ...validated.provenance,sourceUrls: validated.pages.map(p => p.sourceUrl),captureViewport: validated.pages.map(p => p.viewport),hashAlgorithm: 'SHA-256',generatedByLocalScript: true },null,2));
  for (const [name,bytes] of Object.entries(files)) { await mkdir(dirname(resolve(output,name)),{ recursive: true }); await writeFile(resolve(output,name),bytes); }
  const archive = zipSync(Object.fromEntries(Object.entries(files).map(([name,bytes]) => [name,[bytes,{ mtime: new Date('2026-09-23T00:00:00Z') }]])),{ level: 6 });
  await mkdir(resolve('public/samples'),{ recursive: true });
  await writeFile(resolve('public/samples/spacejam-1996.zip'),archive);
  return validated;
}
if (process.argv[1]?.replace(/\\/g,'/').endsWith('/prepare-spacejam-bundle.ts')) {
  const outputIndex = process.argv.indexOf('--output');
  const output = outputIndex >= 0 ? process.argv[outputIndex + 1] : 'fixtures/spacejam-1996';
  const manifest = await buildEvidenceManifest('fixtures/spacejam-raw',output);
  process.stdout.write(`Prepared ${manifest.pages.length} captured pages and ${manifest.assets.length} assets; hashes and manifest validated.\n`);
}
