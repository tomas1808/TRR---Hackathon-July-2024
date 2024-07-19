const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const fileInput = document.getElementById('fileInput');
const imageInput = document.getElementById('imageInput');
const calibrationInput = document.getElementById('calibrationInput');
const snapToggle = document.getElementById('snapToggle');
let points = [];
let selectedPoints = [];
let hoverPoint = null;
let measuring = false;
let lines = [];
let image = null;
let snappingEnabled = snapToggle.checked;
let mmPerPixel = 0.1; // Default value if calibration JSON is not loaded

// Handle file input change event for JSON file
fileInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                lines = JSON.parse(e.target.result);
                adjustCanvasSize();
                drawObject();
            } catch (error) {
                console.error('Error parsing JSON:', error);
            }
        };
        reader.readAsText(file);
    }
});

// Handle file input change event for image file
imageInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            image = new Image();
            image.onload = function() {
                drawObject();
            };
            image.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }
});

// Handle file input change event for calibration JSON file
calibrationInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const calibrationData = JSON.parse(e.target.result);
                mmPerPixel = calibrationData;
                console.log(`Calibration loaded: ${mmPerPixel} mm per pixel`);
            } catch (error) {
                console.error('Error parsing calibration JSON:', error);
            }
        };
        reader.readAsText(file);
    }
});

// Handle snapping toggle
snapToggle.addEventListener('change', (event) => {
    snappingEnabled = event.target.checked;
    drawObject();
});

// Adjust canvas size based on the shape from the loaded file, with no padding
function adjustCanvasSize() {
    if (lines.length === 0) return;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    lines.forEach(line => {
        minX = Math.min(minX, line.start.x, line.end.x);
        minY = Math.min(minY, line.start.y, line.end.y);
        maxX = Math.max(maxX, line.start.x, line.end.x);
        maxY = Math.max(maxY, line.start.y, line.end.y);
    });

    canvas.width = maxX - minX;
    canvas.height = maxY - minY;

    // Offset lines to fit within the canvas with no padding
    lines = lines.map(line => ({
        start: { x: line.start.x - minX, y: line.start.y - minY },
        end: { x: line.end.x - minX, y: line.end.y - minY }
    }));
}

// Draw the 2D object
function drawObject() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (image) {
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    }

    // Do not draw the 2D shape lines
    // ctx.beginPath();
    // lines.forEach(line => {
    //     ctx.moveTo(line.start.x, line.start.y);
    //     ctx.lineTo(line.end.x, line.end.y);
    // });
    // ctx.stroke();

    if (hoverPoint && snappingEnabled) {
        ctx.beginPath();
        ctx.arc(hoverPoint.x, hoverPoint.y, 10, 0, 2 * Math.PI); // Make the snapping pointers twice as big
        ctx.fillStyle = '#00FF00'; // Set the snapping pointers color to violet
        ctx.fill();
    }

    if (selectedPoints.length === 2 || measuring) {
        ctx.beginPath();
        ctx.lineWidth = 3;  // Set the line width to 3 times the default
        ctx.moveTo(selectedPoints[0].x, selectedPoints[0].y);
        if (selectedPoints.length === 2) {
            ctx.lineTo(selectedPoints[1].x, selectedPoints[1].y);

            // Draw the measurement text
            const midX = (selectedPoints[0].x + selectedPoints[1].x) / 2;
            const midY = (selectedPoints[0].y + selectedPoints[1].y) / 2;
            const distanceInPixels = calculateDistanceInPixels(selectedPoints[0], selectedPoints[1]);
            const distanceInMm = convertPixelsToMm(distanceInPixels);
            ctx.font = '40px Arial'; // Make the text twice as big
            ctx.fillStyle = 'red';
            ctx.fillText(`${(distanceInMm/10).toFixed(1)} cm`, midX-200, midY+200);
        } else {
            ctx.lineTo(hoverPoint.x, hoverPoint.y);
        }
        ctx.strokeStyle = '#00FF00';
        ctx.stroke();
        ctx.lineWidth = 1;  // Reset the line width to default
        ctx.strokeStyle = 'black';
    }
}

// Calculate the distance between two points in pixels
function calculateDistanceInPixels(point1, point2) {
    const dx = point2.x - point1.x;
    const dy = point2.y - point1.y;
    return Math.sqrt(dx * dx + dy * dy);
}

// Convert pixel distance to millimeters
function convertPixelsToMm(pixels) {
    return (pixels * mmPerPixel).toFixed(2);
}

// Find the nearest point on the boundary
function findNearestPoint(x, y) {
    let nearestPoint = null;
    let minDistance = Infinity;

    lines.forEach(line => {
        const { start, end } = line;
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const lengthSquared = dx * dx + dy * dy;
        const t = ((x - start.x) * dx + (y - start.y) * dy) / lengthSquared;
        const clampedT = Math.max(0, Math.min(1, t));
        const nearestX = start.x + clampedT * dx;
        const nearestY = start.y + clampedT * dy;
        const distance = Math.hypot(x - nearestX, y - nearestY);

        if (distance < minDistance) {
            minDistance = distance;
            nearestPoint = { x: nearestX, y: nearestY };
        }
    });

    return nearestPoint;
}

// Handle canvas click to select points
canvas.addEventListener('click', (event) => {
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    if (snappingEnabled) {
        if (hoverPoint) {
            if (selectedPoints.length === 2) {
                selectedPoints = []; // Clear previous points
                measuring = false;
            }
            selectedPoints.push(hoverPoint);

            if (selectedPoints.length === 2) {
                const distanceInPixels = calculateDistanceInPixels(selectedPoints[0], selectedPoints[1]);
                const distanceInMm = convertPixelsToMm(distanceInPixels);
                measuring = false;
            } else {
                measuring = true;
            }

            drawObject();
        }
    } else {
        if (selectedPoints.length === 2) {
            selectedPoints = []; // Clear previous points
            measuring = false;
        }
        selectedPoints.push({ x, y });

        if (selectedPoints.length === 2) {
            const distanceInPixels = calculateDistanceInPixels(selectedPoints[0], selectedPoints[1]);
            const distanceInMm = convertPixelsToMm(distanceInPixels);
            measuring = false;
        } else {
            measuring = true;
        }

        drawObject();
    }
});

// Handle mouse move to show snapping circle and update the measurement line
canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    if (snappingEnabled) {
        hoverPoint = findNearestPoint(x, y);
    } else {
        hoverPoint = { x, y };
    }

    if (measuring && selectedPoints.length === 1) {
        const distanceInPixels = calculateDistanceInPixels(selectedPoints[0], hoverPoint);
        const distanceInMm = convertPixelsToMm(distanceInPixels);

        // Draw the dynamic measurement line and text
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawObject();

        ctx.beginPath();
        ctx.lineWidth = 3;  // Set the line width to 3 times the default
        ctx.moveTo(selectedPoints[0].x, selectedPoints[0].y);
        ctx.lineTo(hoverPoint.x, hoverPoint.y);
        ctx.strokeStyle = '#00FF00';
        ctx.stroke();
        ctx.lineWidth = 1;  // Reset the line width to default
        ctx.strokeStyle = 'black';

        // Draw the measurement text
        const midX = (selectedPoints[0].x + hoverPoint.x) / 2;
        const midY = (selectedPoints[0].y + hoverPoint.y) / 2;
        ctx.font = '40px Arial'; // Make the text twice as big
        ctx.fillStyle = 'red';
        ctx.fillText(`${(distanceInMm/10).toFixed(1)} cm`, midX-200, midY+200);
    } else {
        drawObject();
    }
});