import type Feature from 'ol/Feature'
import type { Extent } from 'ol/extent'
import GeoJSON from 'ol/format/GeoJSON'
import type Geometry from 'ol/geom/Geometry'
import VectorLayer from 'ol/layer/Vector'
import { bbox as bboxStrategy } from 'ol/loadingstrategy'
import { transformExtent } from 'ol/proj'
import VectorSource from 'ol/source/Vector'
import { Circle as CircleStyle, Fill, Stroke, Style } from 'ol/style'

const WFS_URL = 'http://localhost:18080/geoserver/ogc_lab/ows'
const DATA_PROJECTION = 'EPSG:4326'

type WfsVectorSource = VectorSource<Feature<Geometry>>
export type WfsVectorLayer = VectorLayer<WfsVectorSource>
export type WfsLayerKey = 'facilities' | 'roads' | 'zones'
export type WfsLoadStatus = 'idle' | 'loading' | 'success' | 'error'

export interface WfsLoadState {
    key: WfsLayerKey
    label: string
    status: WfsLoadStatus
    count?: number
    message?: string
}

interface WfsLayerConfig {
    key: WfsLayerKey
    label: string
    typeName: string
}

type WfsLoadListener = (state: WfsLoadState) => void

// 根据图层名和当前地图范围生成 WFS GetFeature 请求地址
function buildWfsUrl(typeName: string, extent: Extent): string {
    const params = new URLSearchParams({
        service: 'WFS',
        version: '2.0.0',
        request: 'GetFeature',
        typeNames: typeName,
        outputFormat: 'application/json',
        srsName: DATA_PROJECTION,
        bbox: `${extent.join(',')},${DATA_PROJECTION}`,
    })

    return `${WFS_URL}?${params.toString()}`
}

// 创建一个按地图范围请求 GeoJSON 的 WFS 数据源
function createWfsSource(config: WfsLayerConfig, onLoadState: WfsLoadListener): WfsVectorSource {
    const geoJson = new GeoJSON()
    const source = new VectorSource<Feature<Geometry>>({
        strategy: bboxStrategy,

        loader: (extent, _resolution, projection, success, failure) => {
            // 地图范围是 EPSG:3857，WFS 请求范围需要转换成数据使用的 EPSG:4326
            const requestExtent = transformExtent(
                extent,
                projection,
                DATA_PROJECTION,
            )

            // 加载当前地图范围内的 WFS 要素
            async function loadFeatures() {
                onLoadState({
                    key: config.key,
                    label: config.label,
                    status: 'loading',
                })

                try {
                    const response = await fetch(buildWfsUrl(config.typeName, requestExtent))

                    if (!response.ok) {
                        throw new Error(`WFS GetFeature 请求失败：${response.status}`)
                    }

                    const geoJsonText = await response.text()

                    const features = geoJson.readFeatures(geoJsonText, {
                        dataProjection: DATA_PROJECTION,
                        featureProjection: projection,
                    }) as Feature<Geometry>[]

                    source.addFeatures(features)
                    success?.(features)

                    onLoadState({
                        key: config.key,
                        label: config.label,
                        status: 'success',
                        count: features.length,
                    })
                } catch (error) {
                    source.removeLoadedExtent(extent)
                    failure?.()

                    onLoadState({
                        key: config.key,
                        label: config.label,
                        status: 'error',
                        message: error instanceof Error ? error.message : 'WFS GetFeature 请求失败',
                    })
                }
            }

            void loadFeatures()
        },
    })

    return source
}

// 创建点、线、面三个 WFS 矢量图层
export function createWfsLayers(onLoadState: WfsLoadListener): WfsVectorLayer[] {
    const zoneLayer = new VectorLayer({
        visible: false,
        source: createWfsSource({
            key: 'zones',
            label: '服务范围面',
            typeName: 'ogc_lab:demo_zones',
        }, onLoadState),
        style: new Style({
            fill: new Fill({ color: 'rgb(37 99 235 / 18%)' }),
            stroke: new Stroke({ color: '#2563eb', width: 2 }),
        }),
    })

    const roadLayer = new VectorLayer({
        visible: false,
        source: createWfsSource({
            key: 'roads',
            label: '道路',
            typeName: 'ogc_lab:demo_roads',
        }, onLoadState),
        style: new Style({
            stroke: new Stroke({ color: '#f59e0b', width: 4 }),
        }),
    })

    const facilityLayer = new VectorLayer({
        visible: false,
        source: createWfsSource({
            key: 'facilities',
            label: '设施点',
            typeName: 'ogc_lab:facilities',
        }, onLoadState),
        style: new Style({
            image: new CircleStyle({
                radius: 7,
                fill: new Fill({ color: '#16a34a' }),
                stroke: new Stroke({ color: '#ffffff', width: 2 }),
            }),
        }),
    })

    return [zoneLayer, roadLayer, facilityLayer]
}