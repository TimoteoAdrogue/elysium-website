# Mosaic terrarium z10 tiles -> local metric DEM (100 m grid), cached as dem.npz
import numpy as np, os, math
from PIL import Image
from scipy.ndimage import map_coordinates, uniform_filter
D = os.path.dirname(os.path.abspath(__file__))
Z, X0, X1, Y0, Y1 = 10, 527, 541, 355, 366
mos = np.zeros(((Y1-Y0+1)*256, (X1-X0+1)*256), np.float32)
for ty in range(Y0, Y1+1):
    for tx in range(X0, X1+1):
        a = np.asarray(Image.open(f'{D}/tiles/{Z}_{tx}_{ty}.png').convert('RGB'), np.float32)
        mos[(ty-Y0)*256:(ty-Y0+1)*256, (tx-X0)*256:(tx-X0+1)*256] = a[...,0]*256 + a[...,1] + a[...,2]/256 - 32768
LON0, LAT0 = 7.4, 46.6
KX, KY = 111320*math.cos(math.radians(LAT0)), 110574.0
STEP = 100.0
E = np.arange(-150e3, 235e3, STEP); N = np.arange(-130e3, 175e3, STEP)
EE, NN = np.meshgrid(E, N)
lon = LON0 + EE/KX; lat = LAT0 + NN/KY
W = 2**Z * 256
px = (lon+180)/360*W - X0*256
py = (1 - np.log(np.tan(np.radians(lat)) + 1/np.cos(np.radians(lat)))/math.pi)/2*W - Y0*256
h = map_coordinates(mos, [py, px], order=1, mode='nearest').astype(np.float32)
h = np.maximum(h, 0)
# water: flat over a 7x7 window (lakes carry a constant surface elevation)
gy, gx = np.gradient(h)
flat = uniform_filter(np.abs(gx)+np.abs(gy), 7) < 0.15
water = flat & (h < 1500) & (h > 150)
np.savez_compressed(f'{D}/dem.npz', h=h, water=water, E=E, N=N)
print(h.shape, h.min(), h.max(), water.mean())
