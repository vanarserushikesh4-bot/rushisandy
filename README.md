# STRATUM IT INDIA – Laptop Store with Orders & Admin Panel

## What's included
- **Store** (`/`): banners, laptop cards with photos, category tiles, search, filter and sort, a product popup with a photo gallery, a cart, and a checkout that saves orders. Customers also get an Order ID, can send the order on WhatsApp in one tap, and can track it later.
- **Admin panel** (`/admin`, password protected):
  - **Orders**: see every order with the customer's name, phone and address. Change the status (New → Confirmed → Shipped → Delivered / Cancelled). Cancelling puts the stock back. There's also a one-click WhatsApp button for each customer.
  - **Products & Photos**: add, edit and delete laptops, **upload or change photos** (several per laptop, drag & drop, reorder, set the main photo), and edit the price, MRP (shows % OFF), specs, stock and categories. You can also hide or show a laptop.
  - **Banners**: change the top offer images and their links.
  - **Categories**: change the category photos, names and subtitles.
  - **Settings**: store name, WhatsApp number, phone, email, address, logo upload, and **change admin password**.

## Run it on your computer
1. Install **Node.js 18 or newer** from https://nodejs.org
2. Open a terminal in this folder and run:
   ```
   npm install
   npm start
   ```
3. Store: http://localhost:3000  Admin: http://localhost:3000/admin
4. Default admin password: **stratum@123**. Change it right away in Admin → Settings.
   (You can also set the starting password with the environment variable `ADMIN_PASSWORD`.)

## Where data is saved
- `data/db.json`: products, orders, banners, settings and the hashed password. It's created automatically from `data/seed.json` the first time the store runs. **Back up this file.**
- `public/uploads/`: photos you upload from the admin panel.

## Putting it online
This project needs a server that runs **Node.js**, so plain static or HTML-only hosting won't work. Good options:
- **A VPS** (Hostinger VPS, DigitalOcean, AWS Lightsail): upload the folder, run `npm install`, and keep it running with `pm2 start server.js`. Then point your domain to it, with HTTPS through Nginx or Caddy.
- **Hostinger, cPanel or another host with "Node.js App" support**: set the startup file to `server.js`.
- **Render or Railway**: these work too, but you **must add a persistent disk** mounted to `data/` and `public/uploads/`. Without it, orders and photos are lost on every restart.

## Before going live
- Change the admin password.
- Check the WhatsApp number in Admin → Settings.
- Replace the sample laptops, prices and stock with your real stock.
- Upload your own real laptop photos. The starting photos were cut from your design image and are low resolution.
- Payments: there's no online payment gateway. Customers choose Cash on Delivery, UPI or Bank Transfer, and you confirm by phone or WhatsApp. To take card or UPI payments online, you'd need to add a gateway like Razorpay later.
