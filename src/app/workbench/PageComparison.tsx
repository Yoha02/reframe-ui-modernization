import { useEffect,useRef,useState } from 'react';
export function PageComparison({ html,title,originalUrl,width,height,mobile,compare }: { html: string; title: string; originalUrl: string; width: number; height: number; mobile: boolean; compare: number }) {
  const container = useRef<HTMLDivElement>(null),[scale,setScale] = useState(1);
  const frameWidth = mobile ? 390 : width,frameHeight = mobile ? 660 : height;
  useEffect(() => {
    const element = container.current; if (!element) return;
    const resize = () => setScale(Math.min(1,element.clientWidth / frameWidth));
    const observer = new ResizeObserver(resize); observer.observe(element); resize();
    return () => observer.disconnect();
  },[frameWidth]);
  return <div ref={container} className={`comparison ${mobile ? 'mobile' : ''}`} style={{ height: frameHeight * scale + 40 }}><div className="comparison-labels"><span>ORIGINAL</span><span>REIMAGINED · {frameWidth}px</span></div>{!mobile && <img className="comparison-original" src={originalUrl} alt="Original captured page" />}<div className="comparison-new" style={{ clipPath: mobile ? 'none' : `inset(0 0 0 ${compare}%)` }}><iframe title={`Reimagined ${title}`} srcDoc={html} sandbox="" style={{ width: frameWidth,height: frameHeight,transform: `scale(${scale})`,transformOrigin: 'top left' }} /></div>{!mobile && <div className="comparison-divider" style={{ left: `${compare}%` }}><span>↔</span></div>}</div>;
}
