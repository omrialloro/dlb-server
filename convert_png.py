from PIL import Image
import glob
import os
import sys

# Create the frames

frames = []
name = sys.argv[1]
username = sys.argv[2]
speed = int(sys.argv[3])
imgs = glob.glob(f"{name}/*.png")

for i in range(len(imgs)):
    fn = f"{name}/{i}.png"
    new_frame = Image.open(fn)
    frames.append(new_frame)
    os.remove(fn)


# Save into a GIF file that loops forever
frames[0].save(f"{username}/extracted_gifs/{name}.gif", format='GIF',
               append_images=frames[1:],
               save_all=True,
               duration=speed, loop=0)

os.rmdir(name)
