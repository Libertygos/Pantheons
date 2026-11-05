import sys, os
from PIL import Image
C='/home/jules/git-projects/Pantheons/conversion_cartes/cartes_webp/cartes_finales/'
PB='/home/jules/git-projects/Pantheons/conversion_cartes/Pense_Bête.webp'
T='panthflat'
pan={'grec':'pale chartreuse yellow','egyptien':'olive gold','hindou':'warm ochre gold','nordique':'silver grey'}
ico={'grec':'an Ionic column','egyptien':'an Eye of Horus','hindou':'an Om symbol','nordique':'a triskelion'}
eye={'bleus':'turquoise','verts':'green','rouges':'red'}
gods={
 'artemis':('grec','f','bleus','a huntress goddess in profile with dark hair, orange antlers, a quiver of white arrows, a yellow strapless top'),
 'athena':('grec','f','rouges','a warrior goddess in profile wearing a yellow crested helmet with a white plume, white tunic'),
 'bastet':('egyptien','f','rouges','a black cat-headed goddess in profile with red eyes, a red sun disc, a navy headdress, gold collar, turquoise top'),
 'brahma':('hindou','m','rouges','a four-faced bearded god with a long black beard, red eyes, a gold jeweled crown and gold necklaces'),
 'frigg':('nordique','f','verts','a goddess in profile with braided orange hair, a black fur collar, a yellow choker, white dress'),
 'ganesh':('hindou','m','bleus','a turquoise elephant-headed god with a yellow tiara, white tusks, gold and red jeweled necklaces'),
 'isis':('egyptien','f','verts','a goddess in profile with a black bob haircut, a turquoise and gold headband, orange skin, turquoise top'),
 'loki':('nordique','m','verts','a trickster god in profile wearing a white horned helmet, a green hood and a black fur collar'),
 'odin':('nordique','m','bleus','an old one-eyed god with a grey hood, a white beard, a red scar over one eye, a black fur cloak'),
 're':('egyptien','m','rouges','a falcon-headed god in profile with a red sun disc and a golden serpent, a navy and striped headdress, orange chest'),
 'sarasvati':('hindou','f','verts','a goddess in profile with black hair in a bun, gold earrings, a white sari with a yellow border'),
 'zeus':('grec','m','bleus','an old bearded god in profile with grey curly hair and beard, a golden laurel wreath, bare shoulders'),
}
def save(im,name,cap):
    im=im.convert('RGB')
    w,h=im.size; s=max(1, 1024/max(w,h)) if max(w,h)<1024 else 1
    if s>1: im=im.resize((round(w*s),round(h*s)),Image.LANCZOS)
    im.save(f'img/{name}.png'); open(f'img/{name}.txt','w').write(f'{T}, {cap}')
for g,(p,s,e,d) in gods.items():
    save(Image.open(C+f'card_personnages_{g}.webp'),f'god_{g}',
      f'a character card, {d}, flat {pan[p]} background with a broad diagonal {eye[e]} band behind the figure, in the top left corner the name {g.upper()} in a white outlined box and two small white circle icons, {ico[p]} and a {"female" if s=="f" else "male"} symbol, rounded corners')
backs={'personnages':('PERSONNAGE','diagonal stripes of red, turquoise and lime green on pale cream'),
 'attributs':('ATTRIBUT','teal'), 'actions':('ACTION','diagonal stripes of vermilion red and coral on pale peach'),
 'pouvoirs':('POUVOIR','diagonal stripes of deep indigo, violet and lilac')}
for k,(w,c) in backs.items():
    save(Image.open(C+f'card_{k}_verso.webp'),f'back_{k}',f'a card back, {c}, the word {w} in white capitals inside a thin white outlined rectangle at the centre, rounded corners')
