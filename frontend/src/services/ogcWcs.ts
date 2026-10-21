import WebGLTileLayer from 'ol/layer/WebGLTile'
import GeoTIFF from 'ol/source/GeoTIFF'
import TileGrid from 'ol/tilegrid/TileGrid'

const WCS_URL = '/geoserver/ows'
const COVERAGE_ID = 'ogc_lab__qingdao-shinan-dem-12.5m'

function createCoverageUrl(): string {
    const params = new URLSearchParams({
        service: 'WCS',
        version: '2.0.1',
        request: 'GetCoverage',
        coverageId: COVERAGE_ID,
        format: 'image/tiff',
        // OpenLayers 地图使用 EPSG:3857，让 GeoServer 在返回 GeoTIFF 前完成投影转换
        outputCrs: 'http://www.opengis.net/def/crs/EPSG/0/3857',
    })

    return `${WCS_URL}?${params.toString()}`
}

export function createQingdaoDemWcsLayer(): WebGLTileLayer {
    let geotiffExtentAdjusted = false

    const source = new GeoTIFF({
        sources: [
            {
                url: createCoverageUrl(),
                nodata: -32768,
            },
        ],

        // 保留原始高程值，不自动压缩到 0～1。
        normalize: false,

        // WCS 动态接口可能忽略 Range 请求并返回完整文件。
        // 当前实验数据很小，因此允许读取完整响应。
        sourceOptions: {
            allowFullFile: true,
        },

        transition: 0,
    })

    function correctGeoTiffTileGrid(): void {
        if (geotiffExtentAdjusted || source.getState() !== 'ready') {
            return
        }

        const tileGrid = source.getTileGrid()
        const extent = tileGrid?.getExtent()

        if (!tileGrid || !extent) {
            return
        }

        // 当前 OpenLayers 识别的 Y 范围向北偏移了一个影像高度。
        const height = extent[3] - extent[1]

        const correctedExtent = [
            extent[0],
            extent[1] - height,   // minY 下移一个高度
            extent[2],
            extent[3] - height,   // maxY 也下移一个高度
        ]

        const resolutions = tileGrid.getResolutions()

        // 必须重建 TileGrid，不能只修改 extent 数组，
        // 因为 TileGrid 内部已经缓存了完整瓦片范围。
        const correctedTileGrid = new TileGrid({
            extent: correctedExtent,
            minZoom: tileGrid.getMinZoom(),
            origin: tileGrid.getOrigin(tileGrid.getMinZoom()),
            resolutions,
            tileSizes: resolutions.map(
                (_, zoom) => tileGrid.getTileSize(zoom),
            ),
        })

        const sourceInternals = source as unknown as {
            tileGrid: TileGrid
            transformMatrix: number[] | null
        }

        sourceInternals.tileGrid = correctedTileGrid

        // 当前 WCS 输出已经是 EPSG:3857，且影像没有旋转或倾斜。
        // 清除该矩阵，避免进入不必要的重投影瓦片流程。
        sourceInternals.transformMatrix = null

        // 必须先设置标记，再触发 change，
        // 否则 change 事件会再次执行范围修正。
        geotiffExtentAdjusted = true
        source.changed()
    }

    source.on('change', correctGeoTiffTileGrid)

    return new WebGLTileLayer({
        source,
        visible: false,
        opacity: 0.78,

        // 对原始高程值进行客户端设色。
        style: {
            color: [
                // ['interpolate', ['linear'], 输入值, 断点1, 颜色1, 断点2, 颜色2, ...]
                'interpolate',
                ['linear'],  // 两个断点之间做线性插值
                ['band', 1], // 取 GeoTIFF 的第 1 个波段(高程)的值作为输入

                -26, [49, 54, 149, 1],
                0, [69, 117, 180, 1],
                50, [116, 173, 209, 1],
                100, [171, 217, 233, 1],
                150, [255, 255, 191, 1],
                220, [253, 174, 97, 1],
                338, [165, 0, 38, 1],
            ],
        },
    })
}