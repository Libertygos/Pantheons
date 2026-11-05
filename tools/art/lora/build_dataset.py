import sys; sys.path.insert(0,'.')
from clean import *
import os, shutil
C='/home/jules/git-projects/Pantheons/conversion_cartes/cartes_webp/cartes_finales/'
PB='/home/jules/git-projects/Pantheons/conversion_cartes/Pense_Bête.webp'
T='panthflat'; shutil.rmtree('img3',ignore_errors=True); os.makedirs('img3')
def L(n): return np.array(Image.open(C+f'card_{n}.webp').convert('RGB'))
def save(a,name,cap):
    im=Image.fromarray(a); w,h=im.size
    if max(w,h)<1024: s=1024/max(w,h); im=im.resize((round(w*s),round(h*s)),Image.LANCZOS)
    im.save(f'img3/{name}.png'); open(f'img3/{name}.txt','w').write(f'{T}, {cap}')
pan={'grec':'pale chartreuse yellow','egyptien':'olive gold','hindou':'warm ochre gold','nordique':'silver grey'}
ico={'grec':'an Ionic column','egyptien':'an Eye of Horus','hindou':'an Om symbol','nordique':'a triskelion'}
eye={'bleus':'turquoise','verts':'green','rouges':'red'}
exec(open('gods_captions.py').read().split('gods={')[1].join(['gods={','']).split('def save')[0]) if False else None
src=open('gods_captions.py').read(); gods=eval(src.split('gods=')[1].split('\n}')[0]+'\n}')
for g,(p,s,e,d) in gods.items():
    a=L(f'personnages_{g}'); a=diffuse(a,dilate(rectmask(a,(.06,.07,(.55 if g=='athena' else .8),.215),lambda x:white(x,232)),2))
    save(a,f'god_{g}',f'a character card, {d}, flat {pan[p]} background with a broad diagonal {eye[e]} band behind the figure, two small white circle icons in the top left corner, {ico[p]} and a {"female" if s=="f" else "male"} symbol, rounded corners')
teal=None
for v,c in {'bleus':'turquoise','verts':'lime green','rouges':'red'}.items():
    a=L(f'attributs_{v}'); col=mode_color(a,(.2,.6,.8,.7)); a=fill_flat(a,(.07,.5,.93,.88),col)
    save(a,f'attr_{v}',f'a card on white, a large stylised teal almond eye with a {c} iris at the top, below it a plain empty teal panel with rounded corners')
for f,sym in {'feminin':'a female symbol','masculin':'a male symbol','grec':ico['grec'],'egyptien':ico['egyptien'],'indou':ico['hindou'],'nordique':ico['nordique']}.items():
    a=L(f'attributs_{f}'); col=mode_color(a,(.1,.9,.9,.95)); a=fill_flat(a,(.1,.42,.9,.95),col)
    save(a,f'attr_{f}',f'a plain teal card with rounded corners on a white margin, a large white line icon of {sym} inside a white circle in the upper part, the rest of the card empty')
pw={'clonage':'two card outlines side by side, one solid and one dashed','concentration':'a target with an arrow in the bullseye',
    'connaissance':'a glowing light bulb','deduction':'a head in profile with gears inside','espionnage':'a magnifying glass',
    'refus_royal':'a crown','etude':'an open book in dark navy','ames_soeurs_1':'a heart pierced by an arrow','sabotage':'a round bomb with a lit fuse',
    'execution':'a guillotine','optimisse':'a fan of three playing cards'}
for k,i in pw.items():
    a=L(f'pouvoirs_{k}'); m=rectmask(a,(.08,.04,.92,.2),white)|rectmask(a,(.08,.5,.92,.93),white); a=diffuse(a,dilate(m,2))
    save(a,f'pow_{k}',f'a violet card with a soft purple gradient and rounded corners on a white margin, a white line icon of {i} at the centre, the rest of the card empty')
for n,(c) in {7:'red',8:'green',9:'turquoise'}.items():
    a=L(f'actions_non_{n}'); a=fill_flat(a,(.05,.27,.95,.5),np.array([255,255,255])); col=mode_color(a,(.2,.6,.8,.9)); a=fill_flat(a,(.1,.55,.9,.9),col); a=diffuse(a,dilate(rectmask(a,(.07,.5,.93,.94),lambda x:x.min(2)>150),2))
    save(a,f'non_{n}',f'a card on white, a stylised vermilion almond eye with a {c} iris at the top, below it a plain empty vermilion red panel with rounded corners')
for k,c in {'personnages':'diagonal stripes of red, turquoise and lime green on pale cream','actions':'diagonal stripes of vermilion red and coral on pale peach',
            'pouvoirs':'diagonal stripes of deep indigo, violet and lilac','attributs':'diagonal stripes of teal shades'}.items():
    a=L(f'{k}_verso'); m=dilate(rectmask(a,(.04,.33,.96,.67),lambda x:white(x,170)),5); a,ang=stripe_fill(a,m)
    save(a,f'back_{k}',f'a card back with {c}, rounded corners, no emblem'); print(k,'stripe angle',ang)
pb=np.array(Image.open(PB).convert('RGB')); H,W=pb.shape[:2]
navy=mode_color(pb,(0,0,.05,.05))
pb=fill_flat(pb,(.25,.02,.75,.18),navy)                                 # title
pb=diffuse(pb,dilate(rectmask(pb,(.068,.372,.943,.408),white,True),2))   # names row
pb=diffuse(pb,dilate(rectmask(pb,(.031,.41,.068,.77),white,True),2))     # row numbers
for i in range(4):
    x0=.068+i*.2187; pb=diffuse(pb,dilate(rectmask(pb,(x0+.01,.775,x0+.15,.862),white,True),2))
Image.fromarray(pb).save('probe/pb_clean.png')
g='an empty light mint grid of seven rows, plain navy squares at the left of each row'
save(pb,'board_pensebete',f'a game reference sheet on a deep navy background, a row of twelve god portrait tiles with coloured horizontal bands, plain navy cells below them, {g}, a footer of four navy panels each with a white circle icon')
save(pb[:,:W//2],'board_pensebete_left',f'the left half of a game reference sheet on a deep navy background, six god portrait tiles in a row with red, turquoise and green horizontal bands, plain navy cells below, {g}, footer panels with an Om symbol and an Ionic column in white circles')
save(pb[:,W//2:],'board_pensebete_right',f'the right half of a game reference sheet on a deep navy background, six god portrait tiles in a row with red, turquoise and green horizontal bands, plain navy cells below, an empty light mint grid, footer panels with an Eye of Horus and a triskelion in white circles')
