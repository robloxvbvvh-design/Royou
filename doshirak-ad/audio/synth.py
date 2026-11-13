import numpy as np, wave
SR=44100; DUR=27.0; N=int(SR*DUR); rng=np.random.default_rng(7)
L=np.zeros(N); R=np.zeros(N)
def add(sig,t0,gain=1.0,pan=0.0):
    i=int(t0*SR); s=sig[:max(0,N-i)]
    if len(s)==0:return
    L[i:i+len(s)]+=s*gain*(1-max(0,pan)); R[i:i+len(s)]+=s*gain*(1+min(0,pan))
def tt(d): return np.arange(int(d*SR))/SR
def env(d,a=.005,r=None):
    t=tt(d); r=r or d-a; e=np.minimum(t/a,1)*np.exp(-(t)/(r/4)); return e
def lp(x,fc):  # one-pole lowpass, fc array or scalar
    fc=np.broadcast_to(fc,x.shape); a=1-np.exp(-2*np.pi*fc/SR); y=np.empty_like(x); s=0.0
    for i in range(len(x)): s+=a[i]*(x[i]-s); y[i]=s
    return y
def hit(f0=60,d=1.4,click=True):
    t=tt(d); f=f0+120*np.exp(-t*18); ph=2*np.pi*np.cumsum(f)/SR
    s=np.sin(ph)*np.exp(-t*3.2)
    if click:
        n=lp(rng.standard_normal(len(t)),3000)*np.exp(-t*60); s+=n*.5
    return s
def boom(d=2.6):
    t=tt(d); f=45+90*np.exp(-t*9); ph=2*np.pi*np.cumsum(f)/SR
    s=np.sin(ph)*np.exp(-t*1.6)
    n=lp(rng.standard_normal(len(t)),600+4000*np.exp(-t*6))*np.exp(-t*2.2)*.9
    return s+n
def whoosh(d=0.9,up=True):
    n=rng.standard_normal(int(d*SR)); t=tt(d); p=t/d
    fc=(200+5200*np.sin(np.pi*p)**1.5) 
    y=lp(n,fc); y=y-lp(y,150)
    e=np.sin(np.pi*p)**2; return y*e*2.2
def riser(d=1.7):
    n=rng.standard_normal(int(d*SR)); t=tt(d); p=t/d
    y=lp(n,300+7000*p**2); y-=lp(y,200)
    tone=np.sin(2*np.pi*np.cumsum(120+900*p**2)/SR)*.18
    return (y*1.8+tone)*p**2.2
def pop(f=1300,d=.18):
    t=tt(d); return np.sin(2*np.pi*f*t*(1+.25*np.exp(-t*30)))*np.exp(-t*26)*.7
def bubble():
    d=.05; t=tt(d); f=rng.uniform(300,700)*(1+6*t); return np.sin(2*np.pi*np.cumsum(f)/SR)*np.sin(np.pi*t/d)**2*.5
def tick(d=.03,f=2400):
    t=tt(d); return lp(rng.standard_normal(len(t)),f)*np.exp(-t*160)*1.6
def drip(d=.25):
    t=tt(d); f=1500*np.exp(-t*14)+300; return np.sin(2*np.pi*np.cumsum(f)/SR)*np.exp(-t*18)*.8
def ding(f=1318,d=2.5):
    t=tt(d); return (np.sin(2*np.pi*f*t)+.4*np.sin(2*np.pi*f*2.01*t)+.2*np.sin(2*np.pi*f*3.02*t))*np.exp(-t*1.8)*.35
def shimmer(d=1.5):
    t=tt(d); s=0
    for k,f in enumerate([1568,2093,2637,3136]): s=s+np.sin(2*np.pi*f*t+k)*np.exp(-t*(2+k))*.2
    return s*np.minimum(t/.05,1)

# --- music bed (pad), swells over time
t=np.arange(N)/SR
pad=np.zeros(N)
for f,g in [(55,1),(110,.7),(164.8,.5),(220,.45),(261.6,.35),(329.6,.25)]:
    pad+=g*(np.sin(2*np.pi*f*t)+.3*np.sin(2*np.pi*f*2*t+1))*(1+.15*np.sin(2*np.pi*.17*t+f))
swell=np.interp(t,[0,3,8,14,19.6,20.5,24.4,26.0,27],[0,.35,.5,.55,.8,.7,.85,.5,0])
pad*=swell*.05
# soft pulse from 4s: kick-less low pulse + hat ticks from 9s
add(pad,0,1)
for k,tm in enumerate(np.arange(4.4,19.6,.6)): add(hit(52,.5,False),tm,.10 if k%2==0 else .06)
for tm in np.arange(9.3,19.5,.3): add(tick(.02,6000),tm,.10,pan=(.3 if int(tm*10)%2 else -.3))

# --- events
add(hit(55,1.8),.7,.8); add(pop(900),1.9,.5)                     # Голод. / Знакомо?
add(whoosh(.9),3.0,.8,-.2)                                       # T1 cube
add(hit(58,1.5),4.4,.8); add(pop(1500),5.9,.5)                   # Кипяток. / Три минуты.
add(drip(),3.9,.6)
for tm in np.sort(rng.uniform(4.4,8.2,70)): add(bubble(),tm,rng.uniform(.25,.5),pan=rng.uniform(-.6,.6))
add(whoosh(.9),8.3,.8,.2)                                        # T2
add(pop(1100),9.2,.5)
for tm in np.arange(9.0,10.7,.11): add(tick(.025,5000),tm,.18,pan=rng.uniform(-.7,.7))   # noodles drawing
for tm in (10.5,11.6,12.7): add(hit(62,1.1),tm,.75); add(tick(.04,3500),tm,.6)
add(whoosh(.9),14.0,.8,-.2)                                      # T3
add(hit(58,1.4),14.9,.7)
add(drip(),16.0,.7); add(pop(1800),16.9,.4); add(pop(1000),17.8,.6)
for tm in np.arange(16.9,19.4,.5): add(tick(.03,2800),tm,.35)    # clock
add(riser(1.8),18.8,.9)                                          # riser into T4
add(whoosh(.9),19.6,.7)
add(boom(2.8),20.5,1.0)                                          # flash hit
add(whoosh(1.3),20.6,.5)
add(shimmer(),22.6,.5); add(pop(1700),22.6,.4)
add(hit(60,1.3),23.3,.8)
add(boom(3.2),24.6,1.0); add(ding(),24.65,.9); add(shimmer(2.0),24.7,.6)

out=np.stack([L,R],1)
f=np.minimum(t/.05,1)*np.minimum((DUR-t)/.8,1); out*=f[:,None]
out/= np.max(np.abs(out))/.92
w=wave.open('audio/mix.wav','wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
w.writeframes((out*32767).astype('<i2').tobytes()); w.close(); print('ok')
