import manrope from './fonts/manrope.woff2?inline';
import dmSans from './fonts/dm-sans.woff2?inline';
import inter from './fonts/inter.woff2?inline';
import spaceGrotesk from './fonts/space-grotesk.woff2?inline';
import licenses from './fonts/licenses.txt?raw';
const fonts: Record<string,string> = { Manrope: manrope,'DM Sans': dmSans,Inter: inter,'Space Grotesk': spaceGrotesk };
export function fontCss(names: string[]) {
  const used = [...new Set(names)].filter(name => fonts[name]);
  return used.length ? `/* ${licenses.replaceAll('*/','* /')} */\n${used.map(name => `@font-face{font-family:'${name}';font-style:normal;font-weight:100 900;font-display:swap;src:url('${fonts[name]}') format('woff2')}`).join('\n')}` : '';
}
