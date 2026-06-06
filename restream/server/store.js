const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class Store {
  constructor(filePath) {
    this.filePath = filePath || path.join(__dirname, '..', 'data', 'config.json');
    this.data = { destinations: [] };
    this.load();
  }

  load() {
    try {
      const raw = fs.readFileSync(this.filePath, 'utf-8');
      this.data = JSON.parse(raw);
    } catch {
      this.data = { destinations: [] };
      this.save();
    }
  }

  save() {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const tmp = this.filePath + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2));
    fs.renameSync(tmp, this.filePath);
  }

  getDestinations() {
    return this.data.destinations;
  }

  addDestination({ name, rtmpUrl, streamKey, format }) {
    const dest = {
      id: uuidv4(),
      name,
      rtmpUrl,
      streamKey,
      format: format || 'landscape',
      enabled: true,
    };
    this.data.destinations.push(dest);
    this.save();
    return dest;
  }

  updateDestination(id, fields) {
    const dest = this.data.destinations.find((d) => d.id === id);
    if (!dest) return null;
    const allowed = ['name', 'rtmpUrl', 'streamKey', 'enabled', 'format'];
    for (const key of allowed) {
      if (fields[key] !== undefined) dest[key] = fields[key];
    }
    this.save();
    return dest;
  }

  removeDestination(id) {
    const idx = this.data.destinations.findIndex((d) => d.id === id);
    if (idx === -1) return false;
    this.data.destinations.splice(idx, 1);
    this.save();
    return true;
  }

  getDestination(id) {
    return this.data.destinations.find((d) => d.id === id) || null;
  }
}

module.exports = Store;
