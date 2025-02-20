import React, { PureComponent, Fragment } from 'react';
import PropTypes from 'prop-types';
import isEqual from 'react-fast-compare';
import { PluginLeaflet } from 'layer-manager/dist/layer-manager';
import { LayerManager, Layer } from 'layer-manager/dist/components';
import {
  Map as VizzMap,
  Legend as VizzLegend,
  LegendItemToolbar,
  LegendListItem,
  LegendItemButtonInfo,
  LegendItemButtonOpacity
} from 'vizzuality-components/dist/bundle';
import {
  MapControls,
  ShareButton,
  ZoomControl,
  Spinner,
  SourceModal
} from 'aqueduct-components';

// utils
import { logEvent } from 'utils/analytics';

// components
import ShareModal from 'components/modal/share';
import DownloadMapControl from 'components/map/map-controls/download-map';
import BasemapControl from 'components/map/map-controls/basemap';
import MapHeader from './header';
import Legend from './legend';

// helpers
import { prepareMarkerLayer, updateCartoCSS } from './helpers';
import { parseMetadataLayer } from './utils';

// constants
import { LABEL_LAYER_CONFIG } from './constants';

class Map extends PureComponent {
  constructor(props) {
    super(props);

    this.state = {
      layers: props.layers,
      loading: true,
      loadingCartoCSS: false,
      loadingMarkers: false,
      mapElem: {}
    };
  }

  componentWillReceiveProps(nextProps) {
    const {
      layers,
      filters,
      foodLayers,
      mapState,
      parametrization
    } = this.props;
    const {
      layers: nextLayers,
      filters: nextFilters,
      foodLayers: nextFoodLayers,
      mapState: nextMapState,
      parametrization: nextParametrization
    } = nextProps;
    const { zoom } = mapState;
    const { zoom: nextZoom } = nextMapState;
    const layersChanged = !isEqual(layers, nextLayers);
    const filtersChanged = !isEqual(filters, nextFilters);
    const foodLayersChanged = !isEqual(foodLayers, nextFoodLayers);
    const zoomChanged = zoom !== nextZoom;
    const parametrizationChanged = !isEqual(parametrization, nextParametrization);
    const isSingleCropLayer = '32e964db-a2a0-4329-9bb1-470ebc99b622';
    const isAllCropsLayer = 'f67f5553-cc70-441c-9d1a-59044d552d58';

    if ((foodLayersChanged || filtersChanged || zoomChanged || parametrizationChanged)
      && nextFoodLayers[0]) {
      this.setState({ loading: true }, () => {
        prepareMarkerLayer(nextFoodLayers[0], nextFilters, nextZoom, nextParametrization)
          .then((markerLayer) => {
            const { layers: currenLayers } = this.state;
            const filteredLayers = currenLayers.filter(_layer => !_layer.isMarkerLayer);
            this.setState({ layers: [markerLayer, ...filteredLayers] });
          });
      });
    }

    // removes current marker layer if there's no next one
    if (foodLayersChanged && !nextFoodLayers[0]) {
      const { layers: currentLayers } = this.state;
      const layersWithoutMarker = currentLayers.filter(_layer => !_layer.isMarkerLayer);
      this.setState({ layers: layersWithoutMarker });
    }

    // if the incoming layer is the one crop one we need to update its cartoCSS manually
    if (layersChanged && (nextLayers[0] && nextLayers[0].id === isSingleCropLayer)) {
      this.setState({
        loading: true,
        loadingCartoCSS: true
      }, () => {
        updateCartoCSS(nextLayers[0], nextFilters)
          .then((updatedLayer) => {
            const { layers: currentLayers } = this.state;
            // filters any previous all crop layer and one crop layer present.
            const filteredLayers = currentLayers
              .filter(_layer => _layer.category !== 'water')
              .filter(_layer => ![isAllCropsLayer, isSingleCropLayer].includes(_layer.id));

            this.setState({
              loadingCartoCSS: false,
              loading: true,
              layers: [updatedLayer, ...filteredLayers]
            });
          });
      });
    }

    if (layersChanged && (nextLayers[0] && nextLayers[0].id !== isSingleCropLayer)) {
      this.setState({
        layers: nextLayers,
        loading: true
      });
    }
  }

  toggleShareModal() {
    const { toggleModal } = this.props;
    toggleModal(true, { children: ShareModal });
    logEvent('[AQ-Food] Map', 'user clicks on share map', '');
  }

  handleZoomChange(zoom) {
    const { setMapLocation } = this.props;

    setMapLocation({ zoom });
  }

  updateMap(event, map) {
    const { setMapLocation } = this.props;

    setMapLocation({
      zoom: map.getZoom(),
      center: map.getCenter(),
    });
  }

  openLayerInfo(_layerGroup) {
    const { toggleModal } = this.props;
    const { layers } = _layerGroup;
    if (layers[0]) {
      toggleModal(true, {
        children: SourceModal,
        childrenProps: { layer: parseMetadataLayer(layers[0]) }
      });
    }
  }

  handleLayerOpacity(layer, opacity) {
    const { setLayerParametrization } = this.props;

    setLayerParametrization({ opacity });
  }

  render() {
    const {
      mapState,
      basemap,
      bounds,
      countries,
      filters,
      mapControls,
      legend,
      layerGroup
    } = this.props;
    const {
      layers,
      loading,
      loadingCartoCSS,
      loadingMarkers,
      mapElem
    } = this.state;
    const mapEvents = { moveend: (e, _map) => { this.updateMap(e, _map); } };

    return (
      <div className="l-map">
        <Spinner
          isLoading={loading}
          className="-map"
        />
        <VizzMap
          mapOptions={mapState}
          events={mapEvents}
          bounds={bounds}
          basemap={basemap}
          label={LABEL_LAYER_CONFIG}
        >
          {_map => (
            <Fragment>
              <LayerManager
                map={_map}
                plugin={PluginLeaflet}
                onReady={() => {
                  this._map = _map;
                  this.setState({ mapElem: _map });
                  if (!loadingCartoCSS && !loadingMarkers) this.setState({ loading: false });
                }}
              >
                {layers.map((l, i) => (
                    <Layer
                      {...l}
                      key={l.id}
                      opacity={l.opacity}
                      zIndex={1000 - i}
                      {...l.params && { params: l.params }}
                      {...l.sqlParams && { sqlParams: l.sqlParams }}
                      {...l.decodeParams && { decodeParams: l.decodeParams }}
                      {...l.interactionConfig && {
                        interactivity: ['carto', 'cartodb'].includes(l.provider)
                          ? (l.interactionConfig.output || []).map(o => o.column)
                          : true
                      }}
                    />
                  ))}
              </LayerManager>

              {mapControls && (
                <MapControls>
                  <ZoomControl
                    zoom={mapState.zoom}
                    minZoom={mapState.minZoom}
                    maxZoom={mapState.maxZoom}
                    onZoomChange={(zoom) => { this.handleZoomChange(zoom); }}
                  />

                  <BasemapControl />

                  <ShareButton onClick={() => { this.toggleShareModal(); }} />
                  <DownloadMapControl mapElem={mapElem._mapPane} />
                </MapControls>
              )}


              {countries.length > 0 && (<MapHeader />)}

              {legend && layerGroup.length && (
                <div className="l-map-legend">
                  <VizzLegend
                    sortable={false}
                    maxHeight={350}
                  >
                    {layerGroup.map((_layerGroup, i) => (
                      <LegendListItem
                        index={i}
                        key={_layerGroup.dataset}
                        onChangeInfo={() => { this.openLayerInfo(_layerGroup); }}
                        onChangeOpacity={
                          (_layer, _opacity) => { this.handleLayerOpacity(_layer, _opacity); }
                        }
                        layerGroup={_layerGroup}
                        toolbar={(
                          <LegendItemToolbar>
                            <LegendItemButtonInfo />
                            {!_layerGroup.disableOpacity && (
                              <LegendItemButtonOpacity
                                trackStyle={{ backgroundColor: '#2E57B8' }}
                                handleStyle={{ backgroundColor: '#2E57B8' }}
                              />
                            )}
                          </LegendItemToolbar>
                        )}
                      >
                        <Legend
                          className="-map"
                          expanded
                          filters={filters}
                          layers={_layerGroup.layers}
                          onToggleInfo={this.toggleSourceModal}
                        />
                      </LegendListItem>
                    ))}
                  </VizzLegend>
                </div>
              )}
            </Fragment>
          )}
        </VizzMap>
      </div>
    );
  }
}

Map.propTypes = {
  mapState: PropTypes.object.isRequired,
  basemap: PropTypes.object.isRequired,
  bounds: PropTypes.object.isRequired,
  filters: PropTypes.object.isRequired,
  parametrization: PropTypes.object.isRequired,
  layers: PropTypes.array.isRequired,
  layerGroup: PropTypes.array.isRequired,
  mapControls: PropTypes.bool,
  legend: PropTypes.bool,
  foodLayers: PropTypes.array.isRequired,
  countries: PropTypes.array.isRequired,
  toggleModal: PropTypes.func.isRequired,
  setMapLocation: PropTypes.func.isRequired,
  setLayerParametrization: PropTypes.func.isRequired
};

Map.defaultProps = {
  mapControls: true,
  legend: true
};

export default Map;
