import L from 'leaflet/dist/leaflet';
import template from 'lodash/template';

// AQ components
import { CROP_OPTIONS, get, getObjectConversion } from 'aqueduct-components';

// Layers
import BubbleClusterLayer from 'utils/layers/markers/BubbleClusterLayer';

export default class LayerManager {

  // Constructor
  constructor(map, options = {}) {
    this._map = map;
    this._mapLayers = {};
    this._markerLayers = {};
    this._mapRequests = {};
    this._mapLayersLoading = {};
    this._rejectLayersLoading = false;
    this._onLayerAddedSuccess = options.onLayerAddedSuccess;
    this._onLayerAddedError = options.onLayerAddedError;
  }

  /*
    Public methods
  */
  addLayer(layer, opts = {}) {
    const method = {
      cartodb: this._addCartoLayer
    }[layer.provider];

    method && method.call(this, layer, opts);
  }

  removeLayer(layerId) {
    if (this._mapLayers[layerId]) {
      this._map.removeLayer(this._mapLayers[layerId]);
      delete this._mapLayers[layerId];
    }
  }

  removeLayers() {
    Object.keys(this._mapLayers).forEach((id) => {
      if (this._mapLayers[id]) {
        this._map.removeLayer(this._mapLayers[id]);
        delete this._mapLayers[id];
      }
    });
    this._mapLayersLoading = {};
  }

  _addMarkers(geojson, layerConfig) {
    this.removeLayer(layerConfig.id);
    this._mapLayers[layerConfig.id] = new BubbleClusterLayer(
      geojson, layerConfig
    ).addTo(this._map);
  }

  _setMarkers(layerConfig) {
    const { id, zoom } = layerConfig;
    const markers = this._getMarkersByZoom(id, zoom);
    this._addMarkers(markers, layerConfig);
  }

  _getMarkersByZoom(layerId, zoom) {
    let newMarkers = this._markerLayers[layerId];
    if (!newMarkers) return [];

    const sortFunction = (a, b) => {
      const valueA = +a.properties.value;
      const valueB = +b.properties.value;

      if (valueA < valueB) return 1;
      if (valueA > valueB) return -1;
      return 0;
    };

    switch (true) {
      case (zoom > 1 && zoom < 5):
        newMarkers.sort(sortFunction);
        if (newMarkers.length > 5) newMarkers = newMarkers.slice(0, 5);
        break;
      default:
        return newMarkers;
    }

    return newMarkers;
  }

  /**
   * PRIVATE METHODS
   * - _addLoader
   * - _removeLoader
  */
  _addLoader(id) {
    this._mapLayersLoading[id] = true;
  }

  _deleteLoader(id) {
    delete this._mapLayersLoading[id];
    // Check if all the layers are loaded
    if (!Object.keys(this._mapLayersLoading).length) {
      this._onLayerAddedSuccess && this._onLayerAddedSuccess();
    }
  }

  _generateCartoCSS(_layerConfig, params) {
    const { bucket, crop } = params;
    const cartoCss = _layerConfig.body.layers[0].options.cartocss;
    const cartoCssTemplate = template(cartoCss, { interpolate: /{{([\s\S]+?)}}/g });
    const color = CROP_OPTIONS.find(c => c.value === crop).color;

    return cartoCssTemplate({ bucket, color });
  }

  _getLegendValues(layerConfig, legendConfig, options) {
    const layerConfigConverted = getObjectConversion(layerConfig, options, 'water');
    const legendConfigConverted = getObjectConversion(legendConfig, options, 'water');

    // Save loader
    this._addLoader(layerConfig.id);

    // Save request && send
    this._mapRequests[layerConfig.category] = get({
      url: `https://${layerConfig.account}.carto.com/api/v2/sql?q=${legendConfigConverted.sqlQuery}`,
      onSuccess: (data) => {
        const bucket = data.rows[0].bucket;
        if (bucket === null || !bucket) {
          console.error('No buckets available');
          this._deleteLoader(layerConfig.id);
          return;
        }

        const layerConfigParsed = {
          ...layerConfigConverted,
          ...{ body: this._getLayerConfigParsed(layerConfigConverted) }
        };

        layerConfigParsed.body.layers[0].options.cartocss = this._generateCartoCSS(layerConfig, { bucket, crop: options.crop });

        const layerTpl = {
          version: '1.3.0',
          stat_tag: 'API',
          layers: layerConfigParsed.body.layers
        };

        // Save request && send
        this._mapRequests[layerConfig.category] = get({
          url: `https://${layerConfigParsed.account}.carto.com/api/v1/map?stat_tag=API&config=${encodeURIComponent(JSON.stringify(layerTpl))}`,
          onSuccess: (layerData) => {
            const tileUrl = `https://${layerConfigParsed.account}.carto.com/api/v1/map/${layerData.layergroupid}/{z}/{x}/{y}.png`;

            this._mapLayers[layerConfigParsed.id] = L.tileLayer(tileUrl).addTo(this._map).setZIndex(999);

            this._mapLayers[layerConfigParsed.id].on('load', () => {
              this._deleteLoader(layerConfigParsed.id);
            });

            this._mapLayers[layerConfigParsed.id].on('tileerror', () => {
              this._deleteLoader(layerConfigParsed.id);
            });
          },
          onError: (layerData) => {
            console.error(layerData);
            this._deleteLoader(layerConfig.id);
          }
        });
      },
      onError: (data) => {
        console.error(data);
        this._deleteLoader(layerConfig.id);
      }
    });
  }

  _getLayerConfigParsed(_layerConfig) {
    return {
      layers: _layerConfig.body.layers.map((l) => {
        const newOptions = { user_name: _layerConfig.account, cartocss_version: l.options.cartocssVersion };
        const options = { ...l.options, ...newOptions };
        return { ...l, options };
      })
    };
  }

  _addCartoLayer(layerSpec, opts) {
    const layerConfig = {
      ...layerSpec.layerConfig,
      ...{ id: layerSpec.id, category: layerSpec.category }
    };
    const legendConfig = layerSpec.legendConfig;

    const options = opts;

    if (this._mapRequests[layerConfig.category]) {
      if (this._mapRequests[layerConfig.category].readyState !== 4) {
        this._mapRequests[layerConfig.category].abort();
        delete this._mapRequests[layerConfig.category];
        this._deleteLoader(layerConfig.id);
      }
    }

    switch (layerConfig.category) {
      case 'water': {
        // Parse config
        const layerConfigConverted = getObjectConversion(layerConfig, options, 'water');
        const layerConfigParsed = {
          ...layerConfigConverted,
          ...{ body: this._getLayerConfigParsed(layerConfigConverted) }
        };

        const layerTpl = {
          version: '1.3.0',
          stat_tag: 'API',
          layers: layerConfigParsed.body.layers
        };

        // Save loader
        this._addLoader(layerConfig.id);

        // Save request && send
        this._mapRequests[layerConfig.category] = get({
          url: `https://${layerConfig.account}.carto.com/api/v1/map?stat_tag=API&config=${encodeURIComponent(JSON.stringify(layerTpl))}`,
          onSuccess: (data) => {
            const tileUrl = `https://${layerConfig.account}.carto.com/api/v1/map/${data.layergroupid}/{z}/{x}/{y}.png`;

            this._mapLayers[layerConfig.id] = L.tileLayer(tileUrl).addTo(this._map).setZIndex(998);

            this._mapLayers[layerConfig.id].on('load', () => {
              this._deleteLoader(layerConfig.id);
            });
            this._mapLayers[layerConfig.id].on('tileerror', () => {
              this._deleteLoader(layerConfig.id);
            });
          },
          onError: (data) => {
            console.error(data);
            this._deleteLoader(layerConfig.id);
          }
        });
        break;
      }

      case 'food': {
        // Parse config
        const layerConfigConverted = getObjectConversion(layerConfig, options, 'food');

        // Save loader
        this._addLoader(layerConfig.id);

        // Save request && send
        this._mapRequests[layerConfig.category] = get({
          url: layerConfigConverted.body.url,
          onSuccess: (data) => {
            const geojson = data.rows[0].data.features || [];
            const zoom = this._map.getZoom();
            this._markerLayers[layerConfig.id] = geojson;

            this._setMarkers({ ...layerConfig, zoom });
            this._deleteLoader(layerConfig.id);
          },
          onError: (data) => {
            console.error(data);
            this._deleteLoader(layerConfig.id);
          }
        });
        break;
      }

      default: {
        if (legendConfig.sqlQuery) {
          return this._getLegendValues(layerConfig, legendConfig, options);
        }
        const layerConfigConverted = getObjectConversion(layerConfig, options, 'water');
        const layerConfigParsed = {
          ...layerConfigConverted,
          ...{ body: this._getLayerConfigParsed(layerConfigConverted) }
        };

        const layerTpl = {
          version: '1.3.0',
          stat_tag: 'API',
          layers: layerConfigParsed.body.layers
        };

        // Save loader
        this._addLoader(layerConfig.id);

        // Save request && send
        this._mapRequests[layerConfig.category] = get({
          url: `https://${layerConfig.account}.carto.com/api/v1/map?stat_tag=API&config=${encodeURIComponent(JSON.stringify(layerTpl))}`,
          onSuccess: (data) => {
            const tileUrl = `https://${layerConfig.account}.carto.com/api/v1/map/${data.layergroupid}/{z}/{x}/{y}.png`;

            this._mapLayers[layerConfig.id] = L.tileLayer(tileUrl).addTo(this._map).setZIndex(999);

            this._mapLayers[layerConfig.id].on('load', () => {
              this._deleteLoader(layerConfig.id);
            });
            this._mapLayers[layerConfig.id].on('tileerror', () => {
              this._deleteLoader(layerConfig.id);
            });
          },
          onError: (data) => {
            console.error(data);
            this._deleteLoader(layerConfig.id);
          }
        });
        break;
      }
    }
  }
}
