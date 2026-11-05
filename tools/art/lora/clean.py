import numpy as np
from PIL import Image
def dilate(m,r):
    o=m.copy()
    for dy in range(-r,r+1):
        for dx in range(-r,r+1): o|=np.roll(np.roll(m,dy,0),dx,1)
    return o
def diffuse(a,m,it=600):
    a=a.astype(np.float32); ys,xs=np.where(m)
    if len(ys)==0: return a.astype(np.uint8)
    y0,y1,x0,x1=max(ys.min()-2,0),ys.max()+3,max(xs.min()-2,0),xs.max()+3
    sub=a[y0:y1,x0:x1]; mm=m[y0:y1,x0:x1]
    sub[mm]=sub[~mm].mean(0)
    for _ in range(it):
        avg=(np.roll(sub,1,0)+np.roll(sub,-1,0)+np.roll(sub,1,1)+np.roll(sub,-1,1))/4
        sub[mm]=avg[mm]
    a[y0:y1,x0:x1]=sub; return a.clip(0,255).astype(np.uint8)
def white(a,t=200): return (a.min(2)>t)
def rectmask(a,box,pred,drop_lines=False):
    h,w=a.shape[:2]; x0,y0,x1,y1=[int(v*(w if i%2==0 else h)) for i,v in enumerate(box)]
    m=np.zeros((h,w),bool); sub=pred(a[y0:y1,x0:x1])
    if drop_lines:
        sub=sub.copy()
        sub[sub.mean(1)>0.7,:]=False; sub[:,sub.mean(0)>0.7]=False
    m[y0:y1,x0:x1]=sub; return m
def fill_flat(a,box,color):
    h,w=a.shape[:2]; x0,y0,x1,y1=[int(v*(w if i%2==0 else h)) for i,v in enumerate(box)]
    a[y0:y1,x0:x1]=color; return a
def mode_color(a,box):
    h,w=a.shape[:2]; x0,y0,x1,y1=[int(v*(w if i%2==0 else h)) for i,v in enumerate(box)]
    px=a[y0:y1,x0:x1].reshape(-1,3)//4*4; v,c=np.unique(px,axis=0,return_counts=True); return v[c.argmax()]
def namebox(a):
    # white outlined name box top-left of a god card: find its extent from the white runs
    h,w=a.shape[:2]; wm=white(a,215)
    best=None
    for y in range(int(.05*h),int(.25*h)):
        row=wm[y,int(.05*w):int(.85*w)]
        # longest run of white starting near the left edge of the box
        xs=np.where(row)[0]
        if len(xs)<40: continue
        runs=np.split(xs,np.where(np.diff(xs)>1)[0]+1)
        r=max(runs,key=len)
        if len(r)>60 and r[0]<0.15*w:
            x0,x1=r[0]+int(.05*w),r[-1]+int(.05*w)
            best=(y,x0,x1) if best is None else best
            last=(y,x0,x1)
    yt,x0,x1=best; yb=last[0]
    m=np.zeros((h,w),bool); m[yt-2:yb+3,x0-2:x1+3]=wm[yt-2:yb+3,x0-2:x1+3]
    return dilate(m,2)
def stripe_fill(a,m):
    # fill a masked area on parallel diagonal stripes by copying along the best stripe direction
    a=a.astype(np.float32); h,w=m.shape; ys,xs=np.where(m); best=None
    for ang in np.arange(0,180,1.0):
        d=np.array([np.sin(np.radians(ang)),np.cos(np.radians(ang))])
        res=[]
        for s in (1,-1):
            yy=ys.astype(np.float32); xx=xs.astype(np.float32); done=np.zeros(len(ys),bool); col=np.zeros((len(ys),3),np.float32)
            for k in range(1,max(h,w)):
                py=np.clip((ys+s*d[0]*k).round().astype(int),0,h-1); px=np.clip((xs+s*d[1]*k).round().astype(int),0,w-1)
                ok=(~m[py,px])&(~done); col[ok]=a[py[ok],px[ok]]; done|=ok
                if done.all(): break
            res.append(col)
        err=np.abs(res[0]-res[1]).mean()
        if best is None or err<best[0]: best=(err,ang,res[0])
    a[ys,xs]=best[2]; return a.astype(np.uint8), best[1]
