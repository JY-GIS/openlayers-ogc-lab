import TileLayer from 'ol/layer/Tile'
import OSM from 'ol/source/OSM'
import XYZ from 'ol/source/XYZ'

export type BaseMapType = 'osm' | 'topographic'

// 创建标准地图和地形地图两个底图图层
export function createBaseMapLayers() {
    const osmLayer = new TileLayer({
        visible: true,
        source: new OSM(),
    })

    const topographicLayer = new TileLayer({
        visible: false,
        source: new XYZ({
            url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
            maxZoom: 23,
            attributions: 'Sources: © Esri, HERE, Garmin, Intermap, USGS, FAO, NPS, NRCAN, GeoBase, IGN, Kadaster NL, Ordnance Survey, Esri Japan, METI, Esri China (Hong Kong), © OpenStreetMap contributors and the GIS User Community',
        }),
    })

    return {
        osmLayer,
        topographicLayer,
    }
}