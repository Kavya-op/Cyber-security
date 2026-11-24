# CDR & IPDR Intelligence Platform (Rajasthan Police Hackathon)

A forensic-grade Call Detail Record (CDR) and IP Detail Record (IPDR) analytics platform featuring a **strict Neumorphic (Soft UI)** design system tailored for telecom intelligence and law enforcement investigations.

---

## 🎨 Global Design System & Utility Classes

- **Global Background:** `bg-[#E0E5EC]`
- **Text Color:** Deep Navy (`#102a43` / `#0f172a`)
- **Border Radius:** Heavy rounded corners (`rounded-3xl` / `1.5rem`)
- **Neumorphic Utility Classes** (defined in `src/index.css` & `tailwind.config.js`):
  - `.neu-extruded`: Outer drop shadow (`8px 8px 18px #b8bec7, -8px -8px 18px #ffffff`)
  - `.neu-extruded-sm`: Subtle raised shadow (`4px 4px 10px #b8bec7, -4px -4px 10px #ffffff`)
  - `.neu-extruded-lg`: Deep raised shadow (`12px 12px 24px #b2b8c2, -12px -12px 24px #ffffff`)
  - `.neu-recessed`: Inner recessed shadow (`inset 5px 5px 10px #b8bec7, inset -5px -5px 10px #ffffff`)
  - `.neu-recessed-deep`: Deep inset shadow (`inset 8px 8px 16px #abb3bf, inset -8px -8px 16px #ffffff`)
  - `.neu-button`: Tactile button with active inset press state
  - `.neu-input`: Recessed input field with subtle focus halo
  - `.neu-pill-warning`: Red pill warning badge with soft drop shadow

---

## 📂 Project Architecture

```
frontend rajasthan police hackathon/
├── src/
│   ├── components/
│   │   ├── visuals/
│   │   │   ├── UploadAndStats.jsx    # Recessed dropzone + 4 Extruded Stat Cards
│   │   │   ├── NetworkGraph.jsx      # Extruded Card + Interactive Graph + Suspect Search
│   │   │   ├── TowerTimeline.jsx     # Recessed Card + Chronological Stepper + IMEI Anomaly Badges
│   │   │   └── AIChatSidebar.jsx     # Tall Extruded Card + Recessed Chat + Copilot Input
│   │   └── DashboardLayout.jsx       # Navbar ('CDR Analytics') + 70/30 Grid Layout + PDF Dossier
│   ├── dummyData.json                # 5 Synthetic Telecom Records with IMEI Anomaly
│   ├── App.jsx                       # Root Application component
│   ├── main.jsx                      # Vite React mount point
│   └── index.css                     # Neumorphic Tailwind utility layer
├── tailwind.config.js                # Custom shadows, palette & radiuses
├── vite.config.js                    # Vite configuration
└── package.json                      # Project dependencies & scripts
```

---

## 🚀 Running the Project

### Development Server:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build:
```bash
npm run build
```
Builds optimized production assets in `dist/`.
