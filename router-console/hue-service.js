import fetch from 'node-fetch';
import dgram from 'dgram';

/**
 * Philips Hue REST API service for local network light control
 * Communicates with Hue bridges on same network without internet
 */

export class HueService {
  constructor() {
    this.bridgeIp = null;
    this.bridgeUser = null;
    this.lights = [];
    this.discoveryTimeout = 5000;
  }

  /**
   * Discover Hue bridge on local network via UPnP multicast
   */
  async discoverBridge() {
    return new Promise((resolve, reject) => {
      const client = dgram.createSocket('udp4');
      const ssdpRequest =
        'M-SEARCH * HTTP/1.1\r\n' +
        'HOST: 239.255.255.250:1900\r\n' +
        'MAN: "ssdp:discover"\r\n' +
        'MX: 3\r\n' +
        'ST: ssdp:all\r\n' +
        'USER-AGENT: Node.js Hue Discovery\r\n' +
        '\r\n';

      const timeout = setTimeout(() => {
        client.close();
        reject(new Error('Bridge discovery timeout'));
      }, this.discoveryTimeout);

      client.on('message', (message) => {
        const response = message.toString();
        const match = response.match(/Location: (https?:\/\/([^\/:]+))/i);
        if (match) {
          clearTimeout(timeout);
          client.close();
          this.bridgeIp = match[2];
          resolve(this.bridgeIp);
        }
      });

      client.on('error', (err) => {
        clearTimeout(timeout);
        client.close();
        reject(err);
      });

      try {
        client.send(
          ssdpRequest,
          0,
          ssdpRequest.length,
          1900,
          '239.255.255.250',
          (err) => {
            if (err) {
              clearTimeout(timeout);
              client.close();
              reject(err);
            }
          }
        );
      } catch (err) {
        clearTimeout(timeout);
        client.close();
        reject(err);
      }
    });
  }

  /**
   * Create authorized user on bridge (requires physical button press)
   * In production, this would need user interaction on the Hue app
   */
  async createUser(bridgeIp = null) {
    const ip = bridgeIp || this.bridgeIp;
    if (!ip) throw new Error('Bridge IP not set');

    try {
      const response = await fetch(`http://${ip}/api`, {
        method: 'POST',
        body: JSON.stringify({
          devicetype: 'router-console',
          generateclientkey: true,
        }),
      });
      const data = await response.json();

      if (data[0]?.error?.type === 101) {
        throw new Error('Link button not pressed on bridge');
      }

      if (data[0]?.success?.username) {
        this.bridgeUser = data[0].success.username;
        return this.bridgeUser;
      }
      throw new Error(`Unexpected response: ${JSON.stringify(data)}`);
    } catch (err) {
      throw new Error(`Failed to create user: ${err.message}`);
    }
  }

  /**
   * Get all lights from bridge
   */
  async getLights() {
    if (!this.bridgeIp || !this.bridgeUser) {
      return [];
    }

    try {
      const response = await fetch(
        `http://${this.bridgeIp}/api/${this.bridgeUser}/lights`
      );
      const data = await response.json();

      this.lights = Object.entries(data).map(([id, light]) => ({
        id,
        name: light.name,
        state: light.state,
        type: light.type,
        modelid: light.modelid,
        manufacturername: light.manufacturername,
      }));

      return this.lights;
    } catch (err) {
      console.error('Failed to get lights:', err);
      return [];
    }
  }

  /**
   * Control light state (on/off, brightness, color)
   */
  async setLightState(lightId, state) {
    if (!this.bridgeIp || !this.bridgeUser) {
      throw new Error('Bridge not authenticated');
    }

    try {
      const response = await fetch(
        `http://${this.bridgeIp}/api/${this.bridgeUser}/lights/${lightId}/state`,
        {
          method: 'PUT',
          body: JSON.stringify(state),
        }
      );
      const data = await response.json();
      return data;
    } catch (err) {
      throw new Error(`Failed to set light state: ${err.message}`);
    }
  }

  /**
   * Toggle light on/off
   */
  async toggleLight(lightId) {
    const light = this.lights.find(l => l.id === lightId);
    if (!light) throw new Error('Light not found');

    const newState = { on: !light.state.on };
    await this.setLightState(lightId, newState);
    light.state.on = newState.on;
    return light;
  }

  /**
   * Set brightness (0-254)
   */
  async setBrightness(lightId, brightness) {
    const light = this.lights.find(l => l.id === lightId);
    if (!light) throw new Error('Light not found');

    const bri = Math.max(0, Math.min(254, Math.round(brightness)));
    await this.setLightState(lightId, { bri });
    light.state.bri = bri;
    return light;
  }

  /**
   * Set color (xy coordinates) for color lights
   */
  async setColor(lightId, x, y) {
    const light = this.lights.find(l => l.id === lightId);
    if (!light) throw new Error('Light not found');

    await this.setLightState(lightId, { xy: [x, y] });
    light.state.xy = [x, y];
    return light;
  }

  /**
   * Set color temperature for tunable white lights (153-500)
   */
  async setColorTemp(lightId, ct) {
    const light = this.lights.find(l => l.id === lightId);
    if (!light) throw new Error('Light not found');

    const colorTemp = Math.max(153, Math.min(500, Math.round(ct)));
    await this.setLightState(lightId, { ct: colorTemp });
    light.state.ct = colorTemp;
    return light;
  }

  /**
   * Create a scene/preset
   */
  async createScene(name, lights) {
    if (!this.bridgeIp || !this.bridgeUser) {
      throw new Error('Bridge not authenticated');
    }

    try {
      const response = await fetch(
        `http://${this.bridgeIp}/api/${this.bridgeUser}/scenes`,
        {
          method: 'POST',
          body: JSON.stringify({
            name,
            lights,
            recycle: false,
          }),
        }
      );
      const data = await response.json();
      return data;
    } catch (err) {
      throw new Error(`Failed to create scene: ${err.message}`);
    }
  }

  /**
   * Recall scene
   */
  async recallScene(groupId, sceneId) {
    if (!this.bridgeIp || !this.bridgeUser) {
      throw new Error('Bridge not authenticated');
    }

    try {
      const response = await fetch(
        `http://${this.bridgeIp}/api/${this.bridgeUser}/groups/${groupId}/action`,
        {
          method: 'PUT',
          body: JSON.stringify({ scene: sceneId }),
        }
      );
      const data = await response.json();
      return data;
    } catch (err) {
      throw new Error(`Failed to recall scene: ${err.message}`);
    }
  }
}

export default new HueService();
