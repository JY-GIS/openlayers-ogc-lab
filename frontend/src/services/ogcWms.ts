import TileLayer from 'ol/layer/Tile'
import TileWMS from 'ol/source/TileWMS'
import type { Coordinate } from 'ol/coordinate'
import type { ProjectionLike } from 'ol/proj'

const WMS_URL = '/geoserver/ogc_lab/wms'

export interface WmsFeatureInfo {
    id: string
    name: string
    category: string
    geometryType: string
}

interface GeoServerFeatureInfo {
    id?: string
    geometry?: {
        type?: string
    }
    properties: Record<string, unknown>
}

interface GeoServerFeatureInfoResponse {
    features: GeoServerFeatureInfo[]
}

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

// 查询点击位置对应的设施点 WMS 属性
export async function queryFacilitiesFeatureInfo(
    source: TileWMS,
    coordinate: Coordinate,
    resolution: number,
    projection: ProjectionLike,
): Promise<WmsFeatureInfo | null> {
    const url = source.getFeatureInfoUrl(
        coordinate,
        resolution,
        projection,
        {
            INFO_FORMAT: 'application/json',
            FEATURE_COUNT: 1,
        },
    )

    if (!url) return null

    const response = await fetch(url)

    if (!response.ok) {
        throw new Error(`WMS GetFeatureInfo 请求失败：${response.status}`)
    }

    const result = await response.json() as GeoServerFeatureInfoResponse
    const feature = result.features[0]

    if (!feature) return null

    return {
        id: String(feature.properties.id ?? feature.id ?? '--'),
        name: String(feature.properties.name ?? '--'),
        category: String(feature.properties.facility_type ?? '--'),
        geometryType: String(feature.geometry?.type ?? '--'),
    }
}