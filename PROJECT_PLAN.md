# Mine History Tracker - Project Blueprint

## Executive Summary
Replace real-time vehicle tracking with **daily snapshot history**. Each truck has one position per day. Users browse history via date picker and see where trucks were on any given day. Optimized for low-end PCs.

---

## Architecture Overview

```
┌─ Core Engine (Reusable, No Changes)
│  ├─ src/core/Experience.js
│  ├─ src/core/Renderer.js
│  ├─ src/core/Camera.js
│  ├─ src/core/SceneManager.js
│  └─ src/core/AssetLoader.js
│
├─ Mine Domain (Minimal Changes)
│  ├─ src/components/MineEnvironment.js
│  ├─ src/components/LightingSystem.js
│  ├─ src/components/LocationMarkers.js
│  └─ src/components/DrivableVolume.js
│
├─ Vehicle System (REPLACE)
│  ├─ src/components/VehicleManager.js (simplified)
│  ├─ src/components/Vehicle.js (no interpolation)
│  └─ src/utils/VehicleFactory.js (new)
│
├─ History System (NEW)
│  ├─ src/services/HistoryDataService.js (new)
│  ├─ src/services/DailySnapshotLoader.js (new)
│  └─ public/data/truck-history.json (new)
│
├─ UI System (MODIFY)
│  ├─ src/services/UIController.js (add date picker, timeline)
│  ├─ index.html (add history panels)
│  └─ src/styles/history.css (new)
│
└─ Config (UPDATE)
   ├─ public/config/app-config.json (add perf presets)
   └─ public/config/truck-catalog.json (new)
```

---

## Data Format: Daily Truck History

### File: `public/data/truck-history.json`
```json
{
  "metadata": {
    "mine_id": "hindustan_3d",
    "mine_name": "Hindustan 3D Mine",
    "mine_origin": { "x": 1200, "y": -350, "z": 890 },
    "last_updated": "2026-07-01T00:00:00Z",
    "date_range": {
      "start": "2026-06-01",
      "end": "2026-07-01"
    }
  },
  "trucks": [
    {
      "id": "TRUCK_01",
      "type": "dump_truck",
      "driver": "Driver Name",
      "catalog": {
        "model": "/models/vehicles/dumper_truck/dumper-truck.gltf",
        "color": "#FF6600",
        "capacity_tons": 25
      },
      "history": [
        {
          "date": "2026-06-30",
          "position": { "x": 100.5, "y": 10.2, "z": 50.3 },
          "heading": 45,
          "status": "idle",
          "notes": "Maintenance scheduled",
          "location_name": "Loading Bay",
          "fuel_level": 75,
          "work_hours": 8.5,
          "trips": 12,
          "material_moved_tons": 300
        },
        {
          "date": "2026-07-01",
          "position": { "x": 110.2, "y": 10.1, "z": 60.5 },
          "heading": 90,
          "status": "moving",
          "notes": "Operational",
          "location_name": "Main Corridor",
          "fuel_level": 45,
          "work_hours": 6.0,
          "trips": 8,
          "material_moved_tons": 200
        }
      ]
    },
    {
      "id": "TRUCK_02",
      "type": "dump_truck",
      "driver": "Another Driver",
      "catalog": {
        "model": "/models/vehicles/dumper_truck/dumper-truck.gltf",
        "color": "#00FF66",
        "capacity_tons": 25
      },
      "history": [
        {
          "date": "2026-06-30",
          "position": { "x": 80.1, "y": 9.8, "z": 40.2 },
          "heading": 180,
          "status": "idle",
          "notes": "Parked at depot",
          "location_name": "Depot",
          "fuel_level": 90,
          "work_hours": 0,
          "trips": 0,
          "material_moved_tons": 0
        },
        {
          "date": "2026-07-01",
          "position": { "x": 95.5, "y": 10.0, "z": 55.1 },
          "heading": 135,
          "status": "moving",
          "notes": "Operational",
          "location_name": "Extraction Zone",
          "fuel_level": 60,
          "work_hours": 7.5,
          "trips": 10,
          "material_moved_tons": 250
        }
      ]
    }
  ],
  "statistics": {
    "total_trucks": 2,
    "total_history_days": 31,
    "trucks_by_status": {
      "active": 2,
      "maintenance": 0,
      "offline": 0
    }
  }
}
```

### Truck Catalog: `public/config/truck-catalog.json`
```json
{
  "vehicles": [
    {
      "type": "dump_truck",
      "model_path": "/models/vehicles/dumper_truck/dumper-truck.gltf",
      "display_name": "Dump Truck",
      "capacity_tons": 25,
      "icon": "🚛",
      "color": "#FF6600"
    },
    {
      "type": "loader",
      "model_path": "/models/vehicles/loader/loader.gltf",
      "display_name": "Wheel Loader",
      "capacity_tons": 15,
      "icon": "🏗️",
      "color": "#00FF66"
    },
    {
      "type": "haul_truck",
      "model_path": "/models/vehicles/haul_truck/haul_truck.gltf",
      "display_name": "Haul Truck",
      "capacity_tons": 40,
      "icon": "🚚",
      "color": "#0066FF"
    }
  ]
}
```

---

## Performance Presets

### Updated: `public/config/app-config.json`

Add performance tier selection:

```json
{
  "performance": {
    "autodetect": true,
    "defaultTier": "medium",
    "tiers": {
      "low": {
        "renderer": {
          "maxPixelRatio": 1,
          "antialias": false,
          "shadows": false
        },
        "camera": { "fov": 50 },
        "lighting": { "intensity": 0.8 },
        "mine": { "opacity": 0.3, "lod_enabled": true },
        "vehicles": { "max_visible": 10, "interpolation_steps": 2 }
      },
      "medium": {
        "renderer": {
          "maxPixelRatio": 1.5,
          "antialias": true,
          "shadows": false
        },
        "camera": { "fov": 60 },
        "lighting": { "intensity": 1.2 },
        "mine": { "opacity": 0.5, "lod_enabled": true },
        "vehicles": { "max_visible": 25, "interpolation_steps": 5 }
      },
      "high": {
        "renderer": {
          "maxPixelRatio": 2,
          "antialias": true,
          "shadows": false
        },
        "camera": { "fov": 60 },
        "lighting": { "intensity": 1.5 },
        "mine": { "opacity": 0.7, "lod_enabled": false },
        "vehicles": { "max_visible": 50, "interpolation_steps": 10 }
      }
    }
  },
  "renderer": {
    "antialias": true,
    "maxPixelRatio": 1.5,
    "toneMappingExposure": 2.0,
    "shadows": false,
    "clearColor": "0x87ceeb"
  }
}
```

---

## Build Plan: Phases

### Phase 1: Data Layer (Week 1)
**Goal:** Build the history data system

1. Create `src/services/HistoryDataService.js`
   - Load `truck-history.json`
   - Query trucks by date
   - Get truck history range
   - Export snapshots

2. Create `src/services/DailySnapshotLoader.js`
   - Load daily snapshot for a date
   - Create vehicle objects from snapshot
   - Handle missing data gracefully

3. Update `public/config/truck-catalog.json`
   - Vehicle types and models
   - Metadata for display

4. Create sample `public/data/truck-history.json`
   - At least 30 days of data
   - 5-10 sample trucks

**Deliverable:** Able to load and query any day's truck positions

---

### Phase 2: Vehicle System Redesign (Week 1-2)
**Goal:** Simplify vehicles for static daily data

1. Simplify `src/components/VehicleManager.js`
   - Remove interpolation logic
   - Add static positioning from snapshot
   - Add batch create/destroy
   - Add filtering by type/status

2. Create `src/utils/VehicleFactory.js`
   - Factory to spawn vehicle from history record
   - Apply colors and metadata
   - No real-time updates

3. Create `src/components/Vehicle.js` v2
   - Store position, heading, status
   - No interpolation or target tracking
   - Simple update on day change
   - Store trip metadata and notes

**Deliverable:** Can load and display 25+ trucks at once without slowdown

---

### Phase 3: UI & History Timeline (Week 2)
**Goal:** Date picker and history browsing

1. Update `index.html`
   - Add date picker panel (top-left)
   - Add history/details panel (bottom-left)
   - Add truck list with stats (bottom-right)
   - Keep search, filters, location markers

2. Update `src/services/UIController.js`
   - Handle date selection
   - Update UI when date changes
   - Show truck details on click
   - Show history summary for selected truck
   - Add prev/next day buttons

3. Create `src/styles/history.css`
   - Date picker styles
   - Timeline styles
   - Details panel styles

4. Create `src/utils/DateTimeUtils.js`
   - Date formatting
   - Date range validation
   - Date math helpers

**Deliverable:** Users can pick any date and see truck positions

---

### Phase 4: Performance Optimization (Week 2-3)
**Goal:** Run smoothly on weak PCs

1. Update `src/core/Renderer.js`
   - Auto-detect GPU capability
   - Choose performance preset
   - Use requestAnimationFrame efficiently

2. Update `src/components/MineEnvironment.js`
   - Apply opacity from config
   - Use LOD if enabled
   - Frustum culling

3. Update `src/components/LightingSystem.js`
   - Reduce light count on weak PCs
   - Bake ambient light instead of real-time

4. Add `src/utils/DeviceProfiler.js`
   - Detect device capability (GPU, memory, CPU cores)
   - Choose tier automatically
   - Allow manual override

**Deliverable:** App runs on laptops from 2015+

---

### Phase 5: History Playback & Comparison (Week 3-4)
**Goal:** Advanced history features (optional v2)

1. Add playback mode
   - Play through days automatically
   - Show truck trails over time
   - Speed control

2. Add comparison mode
   - Show two dates side-by-side
   - Highlight truck position changes
   - Show statistics delta

3. Add export/report
   - Export truck movement as CSV
   - Generate daily statistics
   - Download as PDF

**Deliverable:** Power users can analyze truck movement patterns

---

## File-by-File Implementation Guide

### New Files to Create

#### 1. `src/services/HistoryDataService.js`
```javascript
export class HistoryDataService {
  constructor() {
    this.data = null;
    this.truckIndex = new Map(); // truckId -> truck object
  }
  
  async load(path) {
    const response = await fetch(path);
    this.data = await response.json();
    this.buildIndex();
    return this.data;
  }
  
  buildIndex() {
    this.data.trucks.forEach(truck => {
      this.truckIndex.set(truck.id, truck);
    });
  }
  
  getTrucksByDate(date) {
    const result = [];
    this.data.trucks.forEach(truck => {
      const snapshot = truck.history.find(h => h.date === date);
      if (snapshot) {
        result.push({
          ...truck,
          snapshot: snapshot
        });
      }
    });
    return result;
  }
  
  getDateRange() {
    return {
      start: this.data.metadata.date_range.start,
      end: this.data.metadata.date_range.end
    };
  }
  
  getTruck(truckId) {
    return this.truckIndex.get(truckId);
  }
  
  getTruckHistory(truckId, limit = 30) {
    const truck = this.getTruck(truckId);
    if (!truck) return [];
    return truck.history.slice(-limit).reverse();
  }
}
```

#### 2. `src/services/DailySnapshotLoader.js`
```javascript
export class DailySnapshotLoader {
  constructor(historyService, truckCatalog) {
    this.historyService = historyService;
    this.catalog = truckCatalog;
  }
  
  getSnapshotForDate(date) {
    return this.historyService.getTrucksByDate(date);
  }
  
  buildVehicleData(snapshotItem) {
    const truck = snapshotItem;
    const snapshot = snapshotItem.snapshot;
    const catalogEntry = this.catalog.vehicles.find(v => v.type === truck.type);
    
    return {
      id: truck.id,
      type: truck.type,
      position: snapshot.position,
      heading: snapshot.heading,
      status: snapshot.status,
      display_name: `${truck.id} - ${truck.driver}`,
      model_path: truck.catalog.model,
      color: truck.catalog.color,
      metadata: {
        driver: truck.driver,
        location: snapshot.location_name,
        fuel_level: snapshot.fuel_level,
        work_hours: snapshot.work_hours,
        trips: snapshot.trips,
        material_tons: snapshot.material_moved_tons,
        notes: snapshot.notes
      }
    };
  }
}
```

#### 3. `src/utils/DeviceProfiler.js`
```javascript
export class DeviceProfiler {
  static profile() {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    const gpu = gl.getParameter(gl.RENDERER);
    
    const cores = navigator.hardwareConcurrency || 4;
    const memory = navigator.deviceMemory || 8;
    const pixelRatio = window.devicePixelRatio || 1;
    
    // Heuristic scoring
    let score = 0;
    if (gpu.includes('GeForce GTX') || gpu.includes('RTX')) score += 3;
    if (gpu.includes('Radeon RX') || gpu.includes('Radeon Pro')) score += 3;
    if (gpu.includes('Intel Iris')) score += 2;
    if (memory >= 16) score += 2;
    if (cores >= 8) score += 1;
    
    if (score >= 6) return 'high';
    if (score >= 3) return 'medium';
    return 'low';
  }
}
```

#### 4. `src/utils/DateTimeUtils.js`
```javascript
export class DateTimeUtils {
  static formatDate(date) {
    if (typeof date === 'string') date = new Date(date);
    return date.toISOString().split('T')[0];
  }
  
  static addDays(dateStr, days) {
    const date = new Date(dateStr);
    date.setDate(date.getDate() + days);
    return this.formatDate(date);
  }
  
  static isValidDate(dateStr) {
    return !isNaN(new Date(dateStr).getTime());
  }
  
  static dateDiff(date1Str, date2Str) {
    const d1 = new Date(date1Str);
    const d2 = new Date(date2Str);
    return Math.floor((d2 - d1) / (1000 * 60 * 60 * 24));
  }
}
```

---

## Integration Points: What to Modify

### 1. `src/core/Experience.js`
Replace initialization:
- Remove WebSocket/VehicleAPIService
- Add HistoryDataService
- Add DailySnapshotLoader
- Add performance auto-detection

### 2. `src/components/VehicleManager.js`
- Remove `preloadModels()` live update logic
- Add `loadDailySnapshot(date)` method
- Simplify `updateVehicle()` to just set position
- Remove interpolation

### 3. `src/services/UIController.js`
- Add date picker HTML binding
- Add date change event listener
- Add truck history display
- Remove real-time connection status

### 4. `index.html`
- Add date picker panel
- Add truck list/timeline panel
- Add truck details panel
- Remove connection indicator (keep for demo)

---

## Quick Start: Minimal MVP (3 Days)

If you want to ship fast, do only this:

1. **Day 1:** Create `HistoryDataService` + sample JSON data
2. **Day 1:** Modify `VehicleManager` to load snapshot
3. **Day 2:** Add date picker HTML + UIController changes
4. **Day 2:** Test with mock data, 5 trucks, 7 days
5. **Day 3:** Performance pass: disable shadows, lower pixel ratio, LOD on/off
6. **Day 3:** Deploy

**That gets you a working daily snapshot viewer in 3 days.** You can add playback, comparison, and advanced UI in v1.1.

---

## Success Metrics

- [ ] Load 30+ trucks simultaneously without frame drops
- [ ] Date picker works smoothly
- [ ] Runs on laptop GPU from 2015+
- [ ] Load time < 5 seconds on 4G
- [ ] History JSON < 5 MB for 1 year of data
- [ ] All trucks visible at once from origin
- [ ] Click truck shows metadata and history
- [ ] Can jump 30 days back instantly
