import { useRef, useState, type PointerEvent } from 'react';

export type Newspaper = { headline: string; drawing: string };

/** A newspaper remains private until the morning report. */
export default function JournalistEditor({ onSubmit }: { onSubmit: (newspaper: Newspaper) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const pointer = useRef<number | null>(null);
  const [headline, setHeadline] = useState('');
  const [drawn, setDrawn] = useState(false);

  function coordinates(event: PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * event.currentTarget.width / rect.width,
      y: (event.clientY - rect.top) * event.currentTarget.height / rect.height };
  }
  function begin(event: PointerEvent<HTMLCanvasElement>) {
    if (pointer.current !== null) return;
    const context = event.currentTarget.getContext('2d');
    if (!context) return;
    event.preventDefault();
    pointer.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    const {x,y} = coordinates(event);
    context.strokeStyle = '#15191c'; context.fillStyle = '#15191c';
    context.lineWidth = 4; context.lineCap = 'round'; context.lineJoin = 'round';
    context.beginPath(); context.arc(x,y,2,0,Math.PI*2); context.fill();
    context.beginPath(); context.moveTo(x,y);
    setDrawn(true);
  }
  function move(event: PointerEvent<HTMLCanvasElement>) {
    if (pointer.current !== event.pointerId) return;
    event.preventDefault();
    const context = event.currentTarget.getContext('2d');
    if (!context) return;
    const {x,y} = coordinates(event);
    context.lineTo(x,y); context.stroke();
  }
  function end(event: PointerEvent<HTMLCanvasElement>) {
    if (pointer.current !== event.pointerId) return;
    pointer.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }
  function clear() {
    const element = canvas.current;
    if (element) element.getContext('2d')?.clearRect(0,0,element.width,element.height);
    setDrawn(false);
  }
  return <section className="newspaper-editor">
    <label className="field-label">YOUR HEADLINE<input value={headline} maxLength={100} onChange={e=>setHeadline(e.target.value)} placeholder="Write a headline" /></label>
    <p className="muted">Draw a picture for the morning newspaper. The headline and drawing will be shown to everyone.</p>
    <canvas ref={canvas} className="drawing-canvas" width={480} height={320} aria-label="Draw your newspaper picture" onPointerDown={begin} onPointerMove={move} onPointerUp={end} onPointerCancel={end} />
    <button type="button" className="secondary" onClick={clear}>CLEAR DRAWING</button>
    <button type="button" className="primary bottom" onClick={()=>onSubmit({headline:headline.trim(),drawing:drawn ? canvas.current?.toDataURL('image/png') || '' : ''})}>PUBLISH IN THE MORNING</button>
    <button type="button" className="secondary" onClick={()=>onSubmit({headline:'',drawing:''})}>SKIP NEWSPAPER</button>
  </section>;
}
