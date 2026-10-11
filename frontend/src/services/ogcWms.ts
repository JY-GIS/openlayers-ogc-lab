import TileLayer from 'ol/layer/Tile'
import TileWMS from 'ol/source/TileWMS'

const WMS_URL = 'http://localhost:18080/geoserver/ogc_lab/wms'

// 创建 GeoServer 设施点 WMS 图层
export function createFacilitiesWmsLayer(): TileLayer<TileWMS> {
    return new TileLayer({
        source: new TileWMS({
            url: WMS_URL,
            params: {
                LAYERS: 'ogc_lab:facilities',
                FORMAT: 'image/png',
                TILED: true,
            },
            serverType: 'geoserver',
        }),
    })
}