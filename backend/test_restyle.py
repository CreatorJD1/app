import asyncio, base64, io, os, time
from dotenv import load_dotenv
load_dotenv()
import ai_service
from PIL import Image

OUT = r"C:\Users\Jason\Documents\GitHub\alpaccaai\data\screenshots"
atlas_path = "texture_refs/original_outfit_atlas.png"
atlas_b64 = base64.b64encode(open(atlas_path, "rb").read()).decode()
orig = Image.open(atlas_path).convert("RGBA")
print("original atlas:", orig.size, "alpha px:", sum(1 for a in orig.getchannel("A").getdata() if a > 8))

async def main():
    t = time.time()
    res = await ai_service.generate_material_texture(
        None, None,
        region="top",
        description="deep navy blue cotton hoodie and vest fabric, subtle knit weave, keep the lace-up and trim details",
        palette="#1b2a4a, #2f4a7a",
        guard=False,
        provider="zerogpu",
        original_atlas_b64=atlas_b64,
        strength=0.42,
    )
    dt = round(time.time() - t)
    img = res["images"][0]
    raw = base64.b64decode(img["data_b64"])
    open(os.path.join(OUT, "restyle_out.png"), "wb").write(raw)
    out = Image.open(io.BytesIO(raw)).convert("RGBA")
    print(f"RESTYLE OK {dt}s | restyle={res.get('restyle')} | out {out.size} {out.mode}")
    print("  out alpha px:", sum(1 for a in out.getchannel("A").getdata() if a > 8))
    # side-by-side for the artifact
    comp = Image.new("RGBA", (orig.width * 2 + 20, orig.height), (20, 24, 34, 255))
    comp.paste(orig, (0, 0)); comp.paste(out.resize(orig.size), (orig.width + 20, 0))
    comp.convert("RGB").save(os.path.join(OUT, "restyle_compare.png"))
    print("  saved restyle_out.png + restyle_compare.png")

asyncio.run(main())
