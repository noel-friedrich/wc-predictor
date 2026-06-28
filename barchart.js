const barChartImageCache = new Map()
const barChartHitBoxes = new WeakMap()
const barChartClickHandlers = new WeakMap()

function getBarChartImage(source, onLoad) {
    if (barChartImageCache.has(source)) {
        return barChartImageCache.get(source)
    }

    const image = new Image()
    image.onload = onLoad
    image.src = source
    barChartImageCache.set(source, image)

    return image
}

function formatPercent(value) {
    return `${Math.round(value * 100)}%`
}

function getNiceChartMaximum(value) {
    if (value <= 0.1) {
        return 0.1
    }

    return Math.min(1, Math.ceil(value * 10) / 10)
}

function drawBarChart(canvas, items, options={}) {
    if (!canvas) {
        return
    }

    const context = canvas.getContext("2d")
    const rect = (canvas.parentElement || canvas).getBoundingClientRect()
    const pixelRatio = window.devicePixelRatio || 1
    const width = Math.max(1, Math.floor(rect.width))
    const height = Math.max(1, Math.floor(rect.height))
    const padding = {
        top: 24,
        right: 18,
        bottom: 72,
        left: 64
    }
    const plotWidth = Math.max(1, width - padding.left - padding.right)
    const plotHeight = Math.max(1, height - padding.top - padding.bottom)
    const maxValue = getNiceChartMaximum(Math.max(...items.map(item => item.value), 0))
    const tickCount = 5
    const hitBoxes = []
    let shouldRedrawAfterImageLoad = false

    canvas.width = Math.floor(width * pixelRatio)
    canvas.height = Math.floor(height * pixelRatio)
    canvas.style.width = "100%"
    canvas.style.height = "100%"
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
    context.clearRect(0, 0, width, height)
    context.font = "12px Arial, system-ui, sans-serif"
    context.lineWidth = 1
    context.textBaseline = "middle"

    context.strokeStyle = "#ddd"
    context.fillStyle = "#333"
    context.textAlign = "right"

    for (let i = 0; i <= tickCount; i++) {
        const value = (maxValue * i) / tickCount
        const y = padding.top + plotHeight - (value / maxValue) * plotHeight

        context.beginPath()
        context.moveTo(padding.left, y)
        context.lineTo(width - padding.right, y)
        context.stroke()
        context.fillText(formatPercent(value), padding.left - 8, y)
    }

    context.strokeStyle = "#111"
    context.beginPath()
    context.moveTo(padding.left, padding.top)
    context.lineTo(padding.left, padding.top + plotHeight)
    context.lineTo(width - padding.right, padding.top + plotHeight)
    context.stroke()

    const slotWidth = plotWidth / Math.max(1, items.length)
    const barWidth = Math.min(56, slotWidth * 0.7)

    for (let i = 0; i < items.length; i++) {
        const item = items[i]
        const barHeight = (item.value / maxValue) * plotHeight
        const x = padding.left + i * slotWidth + (slotWidth - barWidth) / 2
        const y = padding.top + plotHeight - barHeight
        const image = getBarChartImage(item.flagSource, () => {
            drawBarChart(canvas, items, options)
        })

        if (image.complete && image.naturalWidth > 0) {
            const tileCanvas = document.createElement("canvas")
            const tileContext = tileCanvas.getContext("2d")
            tileCanvas.width = 72
            tileCanvas.height = 48
            tileContext.fillStyle = "white"
            tileContext.fillRect(0, 0, tileCanvas.width, tileCanvas.height)
            tileContext.drawImage(image, 0, 0, tileCanvas.width, tileCanvas.height)
            context.fillStyle = context.createPattern(tileCanvas, "repeat")
        } else {
            shouldRedrawAfterImageLoad = true
            context.fillStyle = "#111"
        }

        context.fillRect(x, y, barWidth, barHeight)
        context.strokeStyle = "#111"
        context.strokeRect(x, y, barWidth, barHeight)
        hitBoxes.push({
            item,
            x,
            y,
            width: barWidth,
            height: barHeight
        })

        context.save()
        context.translate(x + barWidth / 2, padding.top + plotHeight + 10)
        context.rotate(-Math.PI / 5)
        context.fillStyle = "#111"
        context.textAlign = "right"
        context.textBaseline = "middle"
        context.fillText(item.label, 0, 0, 72)
        context.restore()
    }

    context.fillStyle = "#111"
    context.textAlign = "center"
    context.textBaseline = "alphabetic"
    context.font = "13px Arial, system-ui, sans-serif"
    context.fillText(options.xAxisTitle || "", padding.left + plotWidth / 2, height - 8)

    context.save()
    context.translate(14, padding.top + plotHeight / 2)
    context.rotate(-Math.PI / 2)
    context.fillText(options.yAxisTitle || "", 0, 0)
    context.restore()

    barChartHitBoxes.set(canvas, hitBoxes)

    if (options.onBarClick && !barChartClickHandlers.has(canvas)) {
        const clickHandler = event => {
            const rect = canvas.getBoundingClientRect()
            const x = event.clientX - rect.left
            const y = event.clientY - rect.top
            const hitBox = (barChartHitBoxes.get(canvas) || []).find(box => {
                return x >= box.x
                    && x <= box.x + box.width
                    && y >= box.y
                    && y <= box.y + box.height
            })

            if (hitBox) {
                options.onBarClick(hitBox.item)
            }
        }

        canvas.addEventListener("click", clickHandler)
        barChartClickHandlers.set(canvas, clickHandler)
        canvas.style.cursor = "pointer"
    }

    if (shouldRedrawAfterImageLoad) {
        return
    }
}
