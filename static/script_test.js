console.log('Test script loaded successfully!');

let frameCount = 0;
let lastFrameCount = 0;
let lastFrameTime = performance.now();

document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM Content Loaded!');
    
    // Test WebSocket connection
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    console.log('Attempting WebSocket connection to:', wsUrl);
    
    const ws = new WebSocket(wsUrl);
    
    ws.onopen = function() {
        console.log('WebSocket connected successfully!');
        document.getElementById('status').textContent = 'Connected!';
    };
    
    ws.onclose = function(event) {
        console.log('WebSocket closed:', event.code, event.reason);
        document.getElementById('status').textContent = 'Disconnected';
    };
    
    ws.onerror = function(error) {
        console.error('WebSocket error:', error);
        document.getElementById('status').textContent = 'Connection Error';
    };
    
    ws.onmessage = function(event) {
        console.log('WebSocket message received:', typeof event.data);
        if (event.data instanceof Blob) {
            console.log('Received video frame, size:', event.data.size);
            
            // Display image
            const url = URL.createObjectURL(event.data);
            const videoElement = document.getElementById('video');
            if (videoElement) {
                videoElement.onload = function() {
                    // Update frame count
                    frameCount++;
                    
                    // Update resolution display
                    const resolutionElement = document.getElementById('resolution');
                    if (resolutionElement && videoElement.naturalWidth && videoElement.naturalHeight) {
                        resolutionElement.textContent = `${videoElement.naturalWidth}×${videoElement.naturalHeight}`;
                    }
                    
                    // Calculate latency
                    const now = performance.now();
                    const latency = Math.round(now - lastFrameTime);
                    lastFrameTime = now;
                    
                    const latencyElement = document.getElementById('latency');
                    if (latencyElement) {
                        latencyElement.textContent = `${latency} ms`;
                    }
                    
                    // Clean up URL
                    URL.revokeObjectURL(url);
                };
                
                videoElement.src = url;
                console.log('Image displayed');
            }
        }
    };
    
    // Update FPS every second
    setInterval(function() {
        const fps = frameCount - lastFrameCount;
        lastFrameCount = frameCount;
        
        const fpsElement = document.getElementById('fps');
        if (fpsElement) {
            fpsElement.textContent = `${fps} FPS`;
        }
    }, 1000);
});

console.log('Script file completely loaded!'); 