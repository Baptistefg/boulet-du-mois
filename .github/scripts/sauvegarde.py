"""Sauvegarde de la base Boulet du mois.

Lit l'URL et la clé publique dans config.js, exporte toutes les tables en JSON
dans backups/AAAA-MM-JJ.json et copie les images qui ne sont pas encore sauvegardées
dans backups/images/<bucket>/. Aucune clé secrète n'est nécessaire.
"""
import datetime
import json
import os
import re
import sys
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
cfg = open(os.path.join(ROOT, "config.js"), encoding="utf-8").read()
url = (re.search(r'supabaseUrl:\s*"([^"]*)"', cfg) or [None, ""])[1].rstrip("/")
key = (re.search(r'supabaseKey:\s*"([^"]*)"', cfg) or [None, ""])[1]
if not url or not key:
    sys.exit("config.js ne contient pas l'URL ou la clé Supabase.")

headers = {"apikey": key}
if key.startswith("eyJ"):
    headers["Authorization"] = "Bearer " + key


def get(path):
    req = urllib.request.Request(url + path, headers=headers)
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def table(name):
    try:
        return json.loads(get("/rest/v1/" + name + "?select=*"))
    except Exception as e:  # table absente (mise à jour SQL pas encore faite)
        print("Table", name, "ignorée :", e)
        return []


data = {name: table(name) for name in ["actions", "votes", "photos", "cup_photos", "contests", "profiles"]}
today = datetime.date.today().isoformat()
out = os.path.join(ROOT, "backups")
os.makedirs(out, exist_ok=True)
with open(os.path.join(out, today + ".json"), "w", encoding="utf-8") as f:
    json.dump({"date": today, **data}, f, ensure_ascii=False, indent=1)
print("Tables sauvegardées :", {k: len(v) for k, v in data.items()})

images = [("photos", p["id"] + ".jpg") for p in data["photos"]]
images += [("coupe", c["id"] + ".jpg") for c in data["cup_photos"]]
images += [("avatars", urllib.parse.quote(p["who"]) + "-" + str(p["v"]) + ".jpg") for p in data["profiles"]]
new = 0
for bucket, name in images:
    dest = os.path.join(out, "images", bucket, urllib.parse.unquote(name))
    if os.path.exists(dest):
        continue
    try:
        blob = get("/storage/v1/object/public/" + bucket + "/" + name)
    except Exception as e:
        print("Image introuvable", bucket, name, ":", e)
        continue
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    with open(dest, "wb") as f:
        f.write(blob)
    new += 1
print("Nouvelles images sauvegardées :", new)
