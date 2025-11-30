// hosepen v1.0.0 - ComfyUI实时绘画插件
console.log('[hosepen] 插件加载中...');

// 全局变量
let canvas = null;
let ctx = null;
let isDrawing = false;
let lastX = 0;
let lastY = 0;
let currentColor = '#000000';
let currentSize = 3;
let drawingWindow = null;
let isEraser = false;
let backgroundColor = '#ffffff';

// 图层系统
let layers = [];
let currentLayerIndex = 0;
let selectedLayerIndices = []; // 多选图层索引数组
let layerIdCounter = 1;

// 图层变换
let transformMode = null; // null, 'scale', 'rotate', 'move'
let transformStartX = 0;
let transformStartY = 0;
let isDraggingTransform = false;
let initialScale = 1;
let initialRotation = 0;
let draggedHandle = null; // 当前拖动的控制点
let initialWidth = 0;
let initialHeight = 0;
let layerBackup = null; // 变换前的图层内容备份
let isDraggingContent = false; // 是否在拖动内容位置
let initialOffsetX = 0;
let initialOffsetY = 0;
let initialLayerOffsets = {}; // 存储多个图层的初始偏移量 {layerIndex: {x, y}}
let animationFrameId = null; // 用于流畅渲染

// 撤销/重做
let historyStack = []; // 历史记录栈
let historyIndex = -1; // 当前历史索引
const MAX_HISTORY = 50; // 最大历史记录数

// 视图变换
let viewScale = 1; // 视图缩放比例
let viewOffsetX = 0; // 视图X偏移
let viewOffsetY = 0; // 视图Y偏移
let isPanning = false; // 是否正在平移
let panStartX = 0; // 平移起始X
let panStartY = 0; // 平移起始Y
let isSpacePressed = false; // 空格键是否按下

// 鼠标位置追踪（用于快捷键冲突检测）
let lastMouseX = 0;
let lastMouseY = 0;

// 创建悬浮按钮
function createButton() {
    // 检查按钮是否已存在
    if (document.querySelector('.hosepen-btn')) {
        console.log('[hosepen] 按钮已存在');
        return;
    }
    
    // 创建按钮元素
    const button = document.createElement('button');
    button.className = 'hosepen-btn';
    button.innerHTML = '🐎';
    button.title = 'hosepen - 实时绘画';
    
    // 按钮样式 - 放在右下角
    button.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 50px;
        height: 50px;
        background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
        border: none;
        outline: none;
        border-radius: 50%;
        color: white;
        font-size: 24px;
        cursor: move;
        z-index: 9999;
        box-shadow: 0 4px 15px rgba(76, 175, 80, 0.4);
        transition: transform 0.2s, box-shadow 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
        user-select: none;
        -webkit-tap-highlight-color: transparent;
    `;
    
    // 悬停效果
    button.addEventListener('mouseenter', () => {
        button.style.transform = 'scale(1.1)';
        button.style.boxShadow = '0 6px 20px rgba(76, 175, 80, 0.6)';
    });
    
    button.addEventListener('mouseleave', () => {
        if (!isDragging) {
            button.style.transform = 'scale(1)';
            button.style.boxShadow = '0 4px 15px rgba(76, 175, 80, 0.4)';
        }
    });
    
    // 拖拽功能
    let isDragging = false;
    let dragStartX, dragStartY;
    let buttonStartX, buttonStartY;
    let hasMoved = false;
    
    button.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        
        isDragging = true;
        hasMoved = false;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        
        const rect = button.getBoundingClientRect();
        buttonStartX = rect.left;
        buttonStartY = rect.top;
        
        button.style.cursor = 'grabbing';
        e.preventDefault();
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        
        const deltaX = e.clientX - dragStartX;
        const deltaY = e.clientY - dragStartY;
        
        if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
            hasMoved = true;
        }
        
        let newX = buttonStartX + deltaX;
        let newY = buttonStartY + deltaY;
        
        // 移除边界限制，允许按钮移动到屏幕外
        button.style.left = newX + 'px';
        button.style.top = newY + 'px';
        button.style.right = 'auto';
        button.style.bottom = 'auto';
    });
    
    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            button.style.cursor = 'move';
            
            if (!hasMoved) {
                toggleDrawingWindow();
            }
        }
    });
    
    // 添加右键菜单功能
    button.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        showContextMenu(e.clientX, e.clientY);
    });
    
    document.body.appendChild(button);
    console.log('[hosepen] 悬浮按钮已创建');
}

// 显示右键菜单
function showContextMenu(x, y) {
    // 移除已存在的菜单
    const existingMenu = document.querySelector('.hosepen-context-menu');
    if (existingMenu) {
        existingMenu.remove();
    }
    
    // 创建菜单容器
    const menu = document.createElement('div');
    menu.className = 'hosepen-context-menu';
    menu.style.cssText = `
        position: fixed;
        left: ${x}px;
        top: ${y}px;
        background: white;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
        z-index: 10001;
        min-width: 150px;
        padding: 8px 0;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        border: 1px solid #e0e0e0;
    `;
    
    // 创建菜单项
    const menuItems = [
        { text: '🎨 打开画板', action: () => toggleDrawingWindow() },
        { text: '🖼️ 打开 Photopea', action: () => openPhotopea() }
    ];
    
    menuItems.forEach(item => {
        const menuItem = document.createElement('div');
        menuItem.textContent = item.text;
        menuItem.style.cssText = `
            padding: 10px 16px;
            cursor: pointer;
            transition: background-color 0.2s;
            user-select: none;
            color: #333;
            font-size: 14px;
            white-space: nowrap;
            display: flex;
            align-items: center;
            gap: 8px;
        `;
        
        menuItem.addEventListener('mouseenter', () => {
            menuItem.style.backgroundColor = '#f5f5f5';
        });
        
        menuItem.addEventListener('mouseleave', () => {
            menuItem.style.backgroundColor = 'transparent';
        });
        
        menuItem.addEventListener('click', () => {
            item.action();
            menu.remove();
        });
        
        menu.appendChild(menuItem);
    });
    
    // 添加到页面
    document.body.appendChild(menu);
    
    // 点击其他地方关闭菜单
    const closeMenu = (e) => {
        if (!menu.contains(e.target)) {
            menu.remove();
            document.removeEventListener('click', closeMenu);
        }
    };
    
    setTimeout(() => {
        document.addEventListener('click', closeMenu);
    }, 100);
}

// 打开 Photopea
function openPhotopea() {
    // 检查是否已存在 Photopea 窗口
    let photopeaWindow = document.querySelector('.photopea-window');
    if (photopeaWindow) {
        // 如果已存在，显示窗口
        photopeaWindow.style.display = 'flex';
        console.log('[hosepen] 显示已存在的 Photopea 窗口');
        return;
    }
    
    // 创建 Photopea 窗口
    photopeaWindow = document.createElement('div');
    photopeaWindow.className = 'photopea-window';
    photopeaWindow.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 1400px;
        height: 900px;
        background: #ffffff;
        border-radius: 12px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        z-index: 10000;
        display: flex;
        flex-direction: column;
        overflow: hidden;
    `;
    
    // 标题栏
    const header = document.createElement('div');
    header.style.cssText = `
        padding: 15px 20px;
        background: linear-gradient(135deg, #2196F3 0%, #1976D2 100%);
        color: white;
        display: flex;
        justify-content: space-between;
        align-items: center;
        cursor: move;
        user-select: none;
    `;
    
    const title = document.createElement('h3');
    title.style.cssText = `
        font-size: 18px;
        font-weight: bold;
        display: flex;
        align-items: center;
        gap: 10px;
        margin: 0;
    `;
    title.innerHTML = '🖼️ Photopea - 在线图像编辑器';
    
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = `
        background: none;
        border: none;
        color: white;
        font-size: 20px;
        cursor: pointer;
        padding: 5px 10px;
        border-radius: 4px;
        transition: background-color 0.2s;
    `;
    
    closeBtn.addEventListener('mouseenter', () => {
        closeBtn.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
    });
    
    closeBtn.addEventListener('mouseleave', () => {
        closeBtn.style.backgroundColor = 'transparent';
    });
    
    closeBtn.addEventListener('click', () => {
        photopeaWindow.style.display = 'none';
    });
    
    // 创建导出按钮
    const exportBtn = document.createElement('button');
    exportBtn.innerHTML = '📤 导出图像';
    exportBtn.title = '导出到ComfyUI工作流';
    exportBtn.style.cssText = `
        background: none;
        border: none;
        color: white;
        font-size: 14px;
        cursor: pointer;
        padding: 5px 15px;
        border-radius: 4px;
        transition: background-color 0.2s;
        margin-right: 5px;
        display: flex;
        align-items: center;
        gap: 5px;
    `;
    
    exportBtn.addEventListener('mouseenter', () => {
        exportBtn.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
    });
    
    exportBtn.addEventListener('mouseleave', () => {
        exportBtn.style.backgroundColor = 'transparent';
    });
    
    exportBtn.addEventListener('click', () => {
        exportPhotopeaToComfyUI(iframe);
    });
    
    // 创建按钮容器
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
        display: flex;
        align-items: center;
    `;
    
    buttonContainer.appendChild(exportBtn);
    buttonContainer.appendChild(closeBtn);
    
    header.appendChild(title);
    header.appendChild(buttonContainer);
    
    // 创建 iframe 容器
    const iframeContainer = document.createElement('div');
    iframeContainer.style.cssText = `
        flex: 1;
        position: relative;
        background: #f0f0f0;
    `;
    
    // 创建 Photopea iframe
    const iframe = document.createElement('iframe');
    iframe.src = 'https://www.photopea.com/';
    iframe.style.cssText = `
        width: 100%;
        height: 100%;
        border: none;
        background: white;
    `;
    
    iframeContainer.appendChild(iframe);
    photopeaWindow.appendChild(header);
    photopeaWindow.appendChild(iframeContainer);
    
    // 添加拖拽功能
    let isDragging = false;
    let dragStartX, dragStartY;
    let windowStartX, windowStartY;
    
    header.addEventListener('mousedown', (e) => {
        isDragging = true;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        
        const rect = photopeaWindow.getBoundingClientRect();
        windowStartX = rect.left;
        windowStartY = rect.top;
        
        header.style.cursor = 'grabbing';
        e.preventDefault();
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        
        const deltaX = e.clientX - dragStartX;
        const deltaY = e.clientY - dragStartY;
        
        let newX = windowStartX + deltaX;
        let newY = windowStartY + deltaY;
        
        photopeaWindow.style.left = newX + 'px';
        photopeaWindow.style.top = newY + 'px';
        photopeaWindow.style.transform = 'none';
    });
    
    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            header.style.cursor = 'move';
        }
    });
    
    // 添加ESC键关闭功能
    const escKeyHandler = (event) => {
        if (event.key === 'Escape') {
            // 检查Photopea窗口是否可见
            const photopeaVisible = photopeaWindow && 
                                  photopeaWindow.style.display === 'flex' && 
                                  document.body.contains(photopeaWindow);
            
            if (photopeaVisible) {
                photopeaWindow.style.display = 'none';
                console.log('[hosepen] ESC键关闭Photopea窗口');
            }
        }
    };
    
    // 添加全局键盘监听器
    document.addEventListener('keydown', escKeyHandler);
    
    // 存储清理函数，当窗口被移除时清理监听器
    photopeaWindow._escKeyHandler = escKeyHandler;
    
    document.body.appendChild(photopeaWindow);
    console.log('[hosepen] 创建 Photopea 窗口 (支持ESC关闭)');
}

// 导出Photopea图像为ComfyUI节点
function exportPhotopeaImage(iframe) {
    try {
        console.log('[hosepen] 开始导出Photopea图像...');
        
        // 显示加载提示
        const loadingMsg = showLoadingMessage('正在从Photopea获取图像数据...');
        
        // 监听来自Photopea的消息
        const messageHandler = (event) => {
            // 只处理来自Photopea的消息，但不严格限制origin（因为可能有不同的协议）
            if (event.source !== iframe.contentWindow) return;
            
            try {
                const data = event.data;
                console.log('[hosepen] 收到Photopea消息:', typeof data, data instanceof ArrayBuffer ? 'ArrayBuffer' : data);
                
                // 处理ArrayBuffer类型的数据（Photopea返回的图像数据）
                if (data instanceof ArrayBuffer) {
                    console.log('[hosepen] 收到ArrayBuffer图像数据，大小:', data.byteLength);
                    window.removeEventListener('message', messageHandler);
                    loadingMsg.remove();
                    
                    // 将ArrayBuffer转换为base64
                    const bytes = new Uint8Array(data);
                    let binary = '';
                    for (let i = 0; i < bytes.byteLength; i++) {
                        binary += String.fromCharCode(bytes[i]);
                    }
                    const base64 = btoa(binary);
                    const dataUrl = 'data:image/png;base64,' + base64;
                    
                    // 生成包含图像数据的ComfyUI节点
                    generateComfyUINodeWithImage(dataUrl);
                    return;
                }
                
                // 检查字符串类型的数据
                if (data && typeof data === 'string') {
                    if (data.startsWith('data:image/')) {
                        // 收到base64图像数据
                        window.removeEventListener('message', messageHandler);
                        loadingMsg.remove();
                        generateComfyUINodeWithImage(data);
                        return;
                    } else if (data === 'no-document') {
                        window.removeEventListener('message', messageHandler);
                        loadingMsg.remove();
                        alert('请先在Photopea中打开或创建一个文档');
                        return;
                    } else if (data === 'export-error') {
                        window.removeEventListener('message', messageHandler);
                        loadingMsg.remove();
                        alert('Photopea导出失败，请尝试手动导出');
                        showExportInstructions();
                        return;
                    }
                }
                
                // 处理对象类型的数据
                if (data && typeof data === 'object' && !(data instanceof ArrayBuffer)) {
                    console.log('[hosepen] 收到对象类型数据:', data);
                    if (data.url && typeof data.url === 'string' && data.url.startsWith('data:image/')) {
                        window.removeEventListener('message', messageHandler);
                        loadingMsg.remove();
                        generateComfyUINodeWithImage(data.url);
                        return;
                    }
                }
            } catch (error) {
                console.error('[hosepen] 处理Photopea消息失败:', error);
                window.removeEventListener('message', messageHandler);
                loadingMsg.remove();
                alert('获取图像数据失败: ' + error.message);
            }
        };
        
        window.addEventListener('message', messageHandler);
        
        // 向Photopea发送导出请求
        // 使用Photopea的简化API
        const exportScript = `
            app.echoToOE = true;
            if (app.activeDocument) {
                app.activeDocument.saveToOE("png");
            } else {
                "no-document";
            }
        `;
        
        // 发送脚本到Photopea
        iframe.contentWindow.postMessage(exportScript, '*');
        
        // 设置超时处理
        setTimeout(() => {
            window.removeEventListener('message', messageHandler);
            if (document.body.contains(loadingMsg)) {
                loadingMsg.remove();
                // 如果无法从Photopea获取图像，直接在ComfyUI中创建空的加载图像节点
                console.log('[hosepen] Photopea API超时，直接创建ComfyUI节点');
                createEmptyLoadImageNode();
            }
        }, 5000); // 减少超时时间到5秒
        
    } catch (error) {
        console.error('[hosepen] 导出失败:', error);
        alert('导出失败: ' + error.message);
    }
}

// 创建空的加载图像节点（当无法从Photopea获取图像时）
function createEmptyLoadImageNode() {
    try {
        console.log('[hosepen] 创建ComfyUI加载图像节点并指导用户传输图像...');
        
        // 直接在ComfyUI中添加空节点
        addEmptyNodeToComfyUIWorkflow()
            .then((nodeElement) => {
                // 显示图像传输指导
                showImageTransferGuide(nodeElement);
                console.log('[hosepen] 节点已添加，显示图像传输指导');
            })
            .catch((error) => {
                console.error('[hosepen] 添加节点失败:', error);
                // 如果还是失败，显示指导
                showExportInstructions();
            });
        
    } catch (error) {
        console.error('[hosepen] 创建节点失败:', error);
        showExportInstructions();
    }
}

// 在ComfyUI工作流中添加空的加载图像节点
async function addEmptyNodeToComfyUIWorkflow() {
    try {
        // 检查是否在ComfyUI环境中
        if (typeof app !== 'undefined' && app.graph && typeof LiteGraph !== 'undefined') {
            console.log('[hosepen] 检测到ComfyUI环境，直接添加节点');
            
            // 直接创建LiteGraph节点
            const litegraphNode = LiteGraph.createNode("LoadImage");
            
            // 设置节点位置（在画布右侧）
            const canvasRect = app.canvas.canvas.getBoundingClientRect();
            const nodes = app.graph._nodes || [];
            let maxX = 100;
            let maxY = 100;
            
            // 找到最右边的节点位置
            nodes.forEach(node => {
                if (node.pos) {
                    maxX = Math.max(maxX, node.pos[0] + (node.size ? node.size[0] : 200));
                    maxY = Math.max(maxY, node.pos[1]);
                }
            });
            
            litegraphNode.pos = [maxX + 50, maxY];
            litegraphNode.title = "Load Image (从Photopea导出)";
            
            // 添加节点到图形
            app.graph.add(litegraphNode);
            app.graph.setDirtyCanvas(true, true);
            
            // 选中新创建的节点
            app.canvas.selectNode(litegraphNode);
            
            console.log('[hosepen] 节点已直接添加到ComfyUI');
            return litegraphNode;
        }
        
        // 如果不在ComfyUI环境中，尝试通过API
        console.log('[hosepen] 未检测到ComfyUI环境，尝试API调用');
        
        // 获取当前工作流
        const currentWorkflow = await getCurrentWorkflow();
        
        // 计算新节点的位置
        const nodePosition = calculateNodePosition(currentWorkflow);
        
        // 生成新的节点ID
        const nodeId = generateUniqueNodeId(currentWorkflow);
        
        // 创建加载图像节点
        const newNode = {
            id: nodeId,
            type: "LoadImage",
            pos: nodePosition,
            size: [320, 314],
            flags: {},
            order: Object.keys(currentWorkflow).length,
            mode: 0,
            inputs: [],
            outputs: [
                {
                    name: "IMAGE",
                    type: "IMAGE",
                    links: null
                },
                {
                    name: "MASK", 
                    type: "MASK",
                    links: null
                }
            ],
            properties: {
                "Node name for S&R": "LoadImage"
            },
            widgets_values: ["", "image"], // 空文件名，用户需要手动上传
            title: "Load Image (从Photopea导出)"
        };
        
        // 添加节点到工作流
        await addNodeToWorkflow(newNode);
        
        console.log('[hosepen] 空节点已通过API添加到工作流:', newNode);
        return newNode;
        
    } catch (error) {
        console.error('[hosepen] 添加空节点到工作流失败:', error);
        throw error;
    }
}

// 显示图像传输指导
function showImageTransferGuide(nodeElement) {
    const guideWindow = document.createElement('div');
    guideWindow.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 600px;
        background: white;
        border-radius: 12px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        z-index: 10001;
        padding: 30px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
    
    guideWindow.innerHTML = `
        <div style="text-align: center; margin-bottom: 20px;">
            <h3 style="color: #2196F3; margin: 0 0 10px 0;">🎨 图像传输指导</h3>
            <p style="color: #666; margin: 0;">已在ComfyUI中创建加载图像节点，请按以下步骤传输图像：</p>
        </div>
        
        <div style="text-align: left; line-height: 1.8; color: #333; margin-bottom: 25px;">
            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                <h4 style="margin: 0 0 10px 0; color: #2196F3;">📋 方法一：右键复制粘贴</h4>
                <p style="margin: 5px 0;"><strong>1.</strong> 在Photopea中右键点击画布</p>
                <p style="margin: 5px 0;"><strong>2.</strong> 选择 "复制合并图层" 或 "Copy Merged"</p>
                <p style="margin: 5px 0;"><strong>3.</strong> 在ComfyUI的加载图像节点上右键粘贴</p>
            </div>
            
            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                <h4 style="margin: 0 0 10px 0; color: #4CAF50;">💾 方法二：保存并拖拽</h4>
                <p style="margin: 5px 0;"><strong>1.</strong> 在Photopea中点击 文件 → 导出为 → PNG</p>
                <p style="margin: 5px 0;"><strong>2.</strong> 保存图像到本地</p>
                <p style="margin: 5px 0;"><strong>3.</strong> 将保存的图像拖拽到ComfyUI的加载图像节点上</p>
            </div>
            
            <div style="background: #fff3cd; padding: 15px; border-radius: 8px; border-left: 4px solid #ffc107;">
                <p style="margin: 0; color: #856404;"><strong>💡 提示：</strong> 推荐使用方法一，更快捷方便！</p>
            </div>
        </div>
        
        <div style="display: flex; gap: 10px; justify-content: center;">
            <button id="highlightNodeBtn" style="
                background: #2196F3;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 14px;
            ">高亮显示节点</button>
            <button id="closeGuideBtn" style="
                background: #666;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 14px;
            ">我知道了</button>
        </div>
    `;
    
    document.body.appendChild(guideWindow);
    
    // 添加事件监听器
    document.getElementById('highlightNodeBtn').addEventListener('click', () => {
        highlightComfyUINode(nodeElement);
    });
    
    document.getElementById('closeGuideBtn').addEventListener('click', () => {
        guideWindow.remove();
    });
    
    // 点击外部关闭
    const closeGuide = (e) => {
        if (!guideWindow.contains(e.target)) {
            guideWindow.remove();
            document.removeEventListener('click', closeGuide);
        }
    };
    
    setTimeout(() => {
        document.addEventListener('click', closeGuide);
    }, 100);
    
    // 显示成功消息
    showSuccessMessage('✅ 已创建加载图像节点，请按指导传输图像');
}

// 高亮显示ComfyUI节点
function highlightComfyUINode(nodeElement) {
    try {
        if (nodeElement && typeof app !== 'undefined' && app.canvas) {
            // 选中并居中显示节点
            app.canvas.selectNode(nodeElement);
            app.canvas.centerOnNode(nodeElement);
            
            // 添加闪烁效果
            let flashCount = 0;
            const flashInterval = setInterval(() => {
                if (nodeElement.bgcolor) {
                    nodeElement.bgcolor = flashCount % 2 === 0 ? "#ffeb3b" : null;
                }
                flashCount++;
                if (flashCount >= 6) {
                    clearInterval(flashInterval);
                    nodeElement.bgcolor = null;
                }
                app.graph.setDirtyCanvas(true, true);
            }, 300);
            
            console.log('[hosepen] 节点已高亮显示');
        }
    } catch (error) {
        console.error('[hosepen] 高亮节点失败:', error);
    }
}

// 显示加载消息
function showLoadingMessage(message) {
    const loadingMsg = document.createElement('div');
    loadingMsg.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 20px 30px;
        border-radius: 8px;
        z-index: 10002;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        display: flex;
        align-items: center;
        gap: 15px;
    `;
    
    loadingMsg.innerHTML = `
        <div style="
            width: 20px;
            height: 20px;
            border: 2px solid #ffffff;
            border-top: 2px solid transparent;
            border-radius: 50%;
            animation: spin 1s linear infinite;
        "></div>
        <span>${message}</span>
    `;
    
    // 添加旋转动画
    const style = document.createElement('style');
    style.textContent = `
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(loadingMsg);
    return loadingMsg;
}

// 生成包含图像数据的ComfyUI节点
function generateComfyUINodeWithImage(imageDataUrl) {
    try {
        // 从data URL中提取base64数据
        const base64Data = imageDataUrl.split(',')[1];
        const timestamp = Date.now();
        const fileName = `photopea_export_${timestamp}.png`;
        
        console.log('[hosepen] 开始添加节点到ComfyUI工作流...');
        console.log('[hosepen] 文件名:', fileName);
        console.log('[hosepen] 图像数据大小:', base64Data.length, '字符');
        
        // 首先上传图像到ComfyUI
        uploadImageToComfyUI(base64Data, fileName)
            .then((result) => {
                console.log('[hosepen] 图像上传成功，结果:', result);
                // 上传成功后，在工作流中添加节点
                return addNodeToComfyUIWorkflow(fileName);
            })
            .then(() => {
                showSuccessMessage('✅ 已成功添加加载图像节点到ComfyUI工作流');
                console.log('[hosepen] 节点已成功添加到ComfyUI工作流');
            })
            .catch((error) => {
                console.error('[hosepen] 添加节点失败:', error);
                console.error('[hosepen] 错误详情:', error.message, error.stack);
                // 如果API调用失败，回退到下载文件的方式
                fallbackToFileDownload(imageDataUrl, fileName, base64Data);
            });
        
    } catch (error) {
        console.error('[hosepen] 生成节点失败:', error);
        alert('生成节点失败: ' + error.message);
    }
}

// 上传图像到ComfyUI（Photopea专用，上传到photopea子文件夹）
async function uploadImageToComfyUI(base64Data, fileName) {
    try {
        // 将base64转换为Blob
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], {type: 'image/png'});
        
        // 创建FormData
        const formData = new FormData();
        formData.append('image', blob, fileName);
        formData.append('type', 'input');
        formData.append('subfolder', 'photopea');  // 上传到photopea子文件夹
        
        // 上传到ComfyUI
        const response = await fetch('/upload/image', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error(`上传失败: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('[hosepen] 图像上传成功:', result);
        return result;
        
    } catch (error) {
        console.error('[hosepen] 上传图像失败:', error);
        throw error;
    }
}

// 在ComfyUI工作流中添加节点
async function addNodeToComfyUIWorkflow(fileName) {
    try {
        // 获取当前工作流
        const currentWorkflow = await getCurrentWorkflow();
        
        // 计算新节点的位置
        const nodePosition = calculateNodePosition(currentWorkflow);
        
        // 生成新的节点ID
        const nodeId = generateUniqueNodeId(currentWorkflow);
        
        // 创建加载图像节点
        const newNode = {
            id: nodeId,
            type: "LoadImage",
            pos: nodePosition,
            size: [320, 314],
            flags: {},
            order: Object.keys(currentWorkflow).length,
            mode: 0,
            inputs: [],
            outputs: [
                {
                    name: "IMAGE",
                    type: "IMAGE",
                    links: null
                },
                {
                    name: "MASK", 
                    type: "MASK",
                    links: null
                }
            ],
            properties: {
                "Node name for S&R": "LoadImage"
            },
            widgets_values: [fileName, "image"],
            title: "Load Image (从Photopea导出)"
        };
        
        // 添加节点到工作流
        await addNodeToWorkflow(newNode);
        
        console.log('[hosepen] 节点已添加到工作流:', newNode);
        
    } catch (error) {
        console.error('[hosepen] 添加节点到工作流失败:', error);
        throw error;
    }
}

// 获取当前工作流
async function getCurrentWorkflow() {
    try {
        // 尝试从ComfyUI API获取当前工作流
        if (typeof app !== 'undefined' && app.graph) {
            return app.graph.serialize();
        }
        
        // 如果无法直接访问，尝试通过API
        const response = await fetch('/api/workflow', {
            method: 'GET'
        });
        
        if (response.ok) {
            return await response.json();
        }
        
        // 返回空工作流
        return {};
        
    } catch (error) {
        console.log('[hosepen] 无法获取当前工作流，使用空工作流');
        return {};
    }
}

// 计算新节点位置
function calculateNodePosition(workflow) {
    const nodes = Object.values(workflow);
    if (nodes.length === 0) {
        return [100, 100];
    }
    
    // 找到最右边的节点位置
    let maxX = 0;
    let maxY = 0;
    
    nodes.forEach(node => {
        if (node.pos) {
            maxX = Math.max(maxX, node.pos[0] + (node.size ? node.size[0] : 200));
            maxY = Math.max(maxY, node.pos[1]);
        }
    });
    
    return [maxX + 50, maxY];
}

// 生成唯一节点ID
function generateUniqueNodeId(workflow) {
    const existingIds = Object.keys(workflow).map(id => parseInt(id)).filter(id => !isNaN(id));
    const maxId = existingIds.length > 0 ? Math.max(...existingIds) : 0;
    return (maxId + 1).toString();
}

// 添加节点到工作流
async function addNodeToWorkflow(node) {
    try {
        console.log('[hosepen] 开始添加节点到工作流...');
        console.log('[hosepen] 检查环境 - app:', typeof app !== 'undefined', 'LiteGraph:', typeof LiteGraph !== 'undefined');
        
        // 尝试直接操作ComfyUI的图形界面
        if (typeof app !== 'undefined' && app.graph && typeof LiteGraph !== 'undefined') {
            console.log('[hosepen] 使用LiteGraph直接创建节点');
            
            const litegraphNode = LiteGraph.createNode("LoadImage");
            litegraphNode.pos = node.pos;
            litegraphNode.title = node.title;
            
            // 设置文件名
            if (litegraphNode.widgets && litegraphNode.widgets[0]) {
                litegraphNode.widgets[0].value = node.widgets_values[0];
                console.log('[hosepen] 设置节点文件名:', node.widgets_values[0]);
            }
            
            app.graph.add(litegraphNode);
            app.graph.setDirtyCanvas(true, true);
            
            console.log('[hosepen] 节点已直接添加到LiteGraph');
            return;
        }
        
        console.log('[hosepen] 无法使用LiteGraph，尝试API调用');
        
        // 如果无法直接操作，尝试API调用
        const response = await fetch('/api/workflow/add_node', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(node)
        });
        
        if (!response.ok) {
            throw new Error(`API调用失败: ${response.status}`);
        }
        
        console.log('[hosepen] 节点已通过API添加');
        
    } catch (error) {
        console.error('[hosepen] 添加节点失败:', error);
        throw error;
    }
}

// 回退到文件下载方式
function fallbackToFileDownload(imageDataUrl, fileName, base64Data) {
    console.log('[hosepen] 无法直接添加节点，尝试替代方案');
    
    // 先尝试只下载图像，让用户手动拖拽到ComfyUI
    downloadImageFile(imageDataUrl, fileName);
    
    // 显示详细的指导信息
    const guideWindow = document.createElement('div');
    guideWindow.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 500px;
        background: white;
        border-radius: 12px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        z-index: 10001;
        padding: 30px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
    
    guideWindow.innerHTML = `
        <div style="text-align: center; margin-bottom: 20px;">
            <h3 style="color: #ff9800; margin: 0 0 10px 0;">⚠️ 需要手动添加节点</h3>
            <p style="color: #666; margin: 0;">图像已下载，请按以下步骤操作：</p>
        </div>
        
        <div style="text-align: left; line-height: 1.8; color: #333; margin-bottom: 25px;">
            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                <p style="margin: 5px 0;"><strong>1.</strong> 在ComfyUI中右键点击空白处</p>
                <p style="margin: 5px 0;"><strong>2.</strong> 选择 "Add Node" → "image" → "LoadImage"</p>
                <p style="margin: 5px 0;"><strong>3.</strong> 将下载的图像文件拖拽到新创建的节点上</p>
            </div>
            
            <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; border-left: 4px solid #2196F3;">
                <p style="margin: 0; color: #1565c0;"><strong>💡 提示：</strong> 图像文件已自动下载到您的下载文件夹</p>
            </div>
        </div>
        
        <div style="display: flex; gap: 10px; justify-content: center;">
            <button id="closeGuideBtn2" style="
                background: #2196F3;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 14px;
            ">我知道了</button>
        </div>
    `;
    
    document.body.appendChild(guideWindow);
    
    document.getElementById('closeGuideBtn2').addEventListener('click', () => {
        guideWindow.remove();
    });
    
    console.log('[hosepen] 已下载图像文件:', fileName);
}

// 下载图像文件
function downloadImageFile(dataUrl, fileName) {
    const downloadLink = document.createElement('a');
    downloadLink.href = dataUrl;
    downloadLink.download = fileName;
    downloadLink.style.display = 'none';
    
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
}

// 显示成功消息
function showSuccessMessage(message) {
    const successMsg = document.createElement('div');
    successMsg.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #4CAF50;
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        z-index: 10002;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        box-shadow: 0 4px 15px rgba(76, 175, 80, 0.3);
        max-width: 300px;
    `;
    successMsg.textContent = message;
    
    document.body.appendChild(successMsg);
    
    setTimeout(() => {
        successMsg.remove();
    }, 5000);
}

// 显示导出指导
function showExportInstructions() {
    const instructionWindow = document.createElement('div');
    instructionWindow.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 500px;
        background: white;
        border-radius: 12px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        z-index: 10001;
        padding: 30px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
    
    instructionWindow.innerHTML = `
        <div style="text-align: center; margin-bottom: 20px;">
            <h3 style="color: #2196F3; margin: 0 0 10px 0;">📤 导出为ComfyUI节点</h3>
            <p style="color: #666; margin: 0;">请按照以下步骤导出图像：</p>
        </div>
        
        <div style="text-align: left; line-height: 1.6; color: #333;">
            <p><strong>步骤 1:</strong> 在Photopea中点击 <code>文件 → 导出为 → PNG</code></p>
            <p><strong>步骤 2:</strong> 下载图像到本地</p>
            <p><strong>步骤 3:</strong> 点击下方按钮生成ComfyUI节点</p>
        </div>
        
        <div style="display: flex; gap: 10px; justify-content: center; margin-top: 25px;">
            <button id="generateNodeBtn" style="
                background: #4CAF50;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 14px;
            ">生成加载图像节点</button>
            <button id="closeInstructionBtn" style="
                background: #666;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 14px;
            ">关闭</button>
        </div>
    `;
    
    document.body.appendChild(instructionWindow);
    
    // 添加事件监听器
    document.getElementById('generateNodeBtn').addEventListener('click', () => {
        generateComfyUINode();
        instructionWindow.remove();
    });
    
    document.getElementById('closeInstructionBtn').addEventListener('click', () => {
        instructionWindow.remove();
    });
    
    // 点击外部关闭
    const closeInstruction = (e) => {
        if (!instructionWindow.contains(e.target)) {
            instructionWindow.remove();
            document.removeEventListener('click', closeInstruction);
        }
    };
    
    setTimeout(() => {
        document.addEventListener('click', closeInstruction);
    }, 100);
}

// 生成ComfyUI加载图像节点
function generateComfyUINode() {
    const nodeData = {
        "1": {
            "inputs": {
                "image": "image.png",
                "upload": "image"
            },
            "class_type": "LoadImage",
            "meta": {
                "title": "Load Image (从Photopea导出)"
            }
        }
    };
    
    // 创建下载链接
    const dataStr = JSON.stringify(nodeData, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    const url = URL.createObjectURL(dataBlob);
    
    const downloadLink = document.createElement('a');
    downloadLink.href = url;
    downloadLink.download = 'photopea_load_image_node.json';
    downloadLink.style.display = 'none';
    
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    
    URL.revokeObjectURL(url);
    
    // 显示成功消息
    const successMsg = document.createElement('div');
    successMsg.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #4CAF50;
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        z-index: 10002;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        box-shadow: 0 4px 15px rgba(76, 175, 80, 0.3);
    `;
    successMsg.textContent = '✅ ComfyUI节点已生成并下载';
    
    document.body.appendChild(successMsg);
    
    setTimeout(() => {
        successMsg.remove();
    }, 3000);
    
    console.log('[hosepen] ComfyUI加载图像节点已生成');
}

// 切换绘画窗口
function toggleDrawingWindow() {
    if (!drawingWindow) {
        createDrawingWindow();
    }
    
    if (drawingWindow.style.display === 'none') {
        drawingWindow.style.display = 'flex';
    } else {
        drawingWindow.style.display = 'none';
    }
}

// 创建绘画窗口
function createDrawingWindow() {
    drawingWindow = document.createElement('div');
    drawingWindow.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 1200px;
        height: 750px;
        background: #ffffff;
        border-radius: 12px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        z-index: 10000;
        display: none;
        flex-direction: column;
        overflow: hidden;
    `;
    
    // 标题栏
    const header = document.createElement('div');
    header.id = 'hosepen-title-bar';
    header.style.cssText = `
        padding: 15px 20px;
        background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
        color: white;
        display: flex;
        justify-content: space-between;
        align-items: center;
        cursor: move;
        user-select: none;
    `;
    
    const title = document.createElement('h3');
    title.style.cssText = `
        font-size: 18px;
        font-weight: bold;
        display: flex;
        align-items: center;
        gap: 10px;
    `;
    title.innerHTML = '🐎 hosepen - 实时绘画板';
    
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = `
        background: rgba(255, 255, 255, 0.2);
        border: none;
        color: white;
        width: 30px;
        height: 30px;
        border-radius: 50%;
        cursor: pointer;
        font-size: 18px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.2s;
    `;
    closeBtn.addEventListener('mouseenter', () => {
        closeBtn.style.background = 'rgba(255, 255, 255, 0.3)';
    });
    closeBtn.addEventListener('mouseleave', () => {
        closeBtn.style.background = 'rgba(255, 255, 255, 0.2)';
    });
    closeBtn.addEventListener('click', () => {
        drawingWindow.style.display = 'none';
    });
    
    header.appendChild(title);
    header.appendChild(closeBtn);
    
    // 工具栏
    const toolbar = document.createElement('div');
    toolbar.style.cssText = `
        padding: 15px 20px;
        background: #f5f5f5;
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        align-items: center;
        border-bottom: 1px solid #ddd;
    `;
    
    // 颜色选择器（无标签）
    const colorPicker = document.createElement('input');
    colorPicker.type = 'color';
    colorPicker.value = currentColor;
    colorPicker.style.cssText = `
        width: 50px;
        height: 35px;
        border: 2px solid #ddd;
        border-radius: 6px;
        cursor: pointer;
    `;
    colorPicker.addEventListener('change', (e) => {
        currentColor = e.target.value;
    });
    
    // 画笔大小（无标签）
    const sizeSlider = document.createElement('input');
    sizeSlider.type = 'range';
    sizeSlider.min = '1';
    sizeSlider.max = '20';
    sizeSlider.value = currentSize;
    sizeSlider.style.cssText = `
        width: 150px;
        cursor: pointer;
    `;
    sizeSlider.addEventListener('input', (e) => {
        currentSize = parseInt(e.target.value);
        sizeValue.textContent = currentSize + 'px';
    });
    
    const sizeValue = document.createElement('span');
    sizeValue.textContent = currentSize + 'px';
    sizeValue.style.cssText = `
        font-size: 14px;
        color: #666;
        min-width: 40px;
    `;
    
    // 画笔按钮
    const brushBtn = document.createElement('button');
    brushBtn.textContent = '✏️';
    brushBtn.style.cssText = `
        padding: 8px 16px;
        background: #2196F3;
        border: none;
        border-radius: 6px;
        color: white;
        cursor: pointer;
        font-size: 14px;
        margin-left: 10px;
        transition: background 0.2s;
    `;
    brushBtn.addEventListener('click', () => {
        isEraser = false;
        transformMode = null;
        // 清除所有变换状态
        isDraggingTransform = false;
        draggedHandle = null;
        isDraggingContent = false;
        canvas.style.cursor = 'crosshair';
        brushBtn.style.background = '#2196F3';
        eraserBtn.style.background = '#9E9E9E';
        showNotification('🖌️ 画笔模式', 'info');
    });
    
    // 橡皮擦按钮
    const eraserBtn = document.createElement('button');
    eraserBtn.textContent = '🧹';
    eraserBtn.style.cssText = `
        padding: 8px 16px;
        background: #9E9E9E;
        border: none;
        border-radius: 6px;
        color: white;
        cursor: pointer;
        font-size: 14px;
        transition: background 0.2s;
    `;
    eraserBtn.addEventListener('click', () => {
        isEraser = true;
        transformMode = null;
        // 清除所有变换状态
        isDraggingTransform = false;
        draggedHandle = null;
        isDraggingContent = false;
        canvas.style.cursor = 'crosshair';
        eraserBtn.style.background = '#FF9800';
        brushBtn.style.background = '#9E9E9E';
        showNotification('🧹 橡皮擦模式', 'info');
    });
    
    // 背景颜色选择器（无标签）
    const bgColorPicker = document.createElement('input');
    bgColorPicker.type = 'color';
    bgColorPicker.value = backgroundColor;
    bgColorPicker.style.cssText = `
        width: 50px;
        height: 35px;
        border: 2px solid #ddd;
        border-radius: 6px;
        cursor: pointer;
    `;
    bgColorPicker.addEventListener('change', (e) => {
        backgroundColor = e.target.value;
        canvas.style.background = backgroundColor;
        mergeAndRender(); // 重新渲染画板
    });
    
    // 清空按钮
    const clearBtn = document.createElement('button');
    clearBtn.textContent = '🗑️ 清空';
    clearBtn.style.cssText = `
        padding: 8px 16px;
        background: #f44336;
        border: none;
        border-radius: 6px;
        color: white;
        cursor: pointer;
        font-size: 14px;
        margin-left: auto;
        transition: background 0.2s;
    `;
    clearBtn.addEventListener('mouseenter', () => {
        clearBtn.style.background = '#d32f2f';
    });
    clearBtn.addEventListener('mouseleave', () => {
        clearBtn.style.background = '#f44336';
    });
    clearBtn.addEventListener('click', clearCanvas);
    
    // 保存按钮
    const saveBtn = document.createElement('button');
    saveBtn.textContent = '💾 保存';
    saveBtn.title = '保存图像到本地 (或按 Ctrl+C 复制到剪贴板)';
    saveBtn.style.cssText = `
        padding: 8px 16px;
        background: #2196F3;
        border: none;
        border-radius: 6px;
        color: white;
        cursor: pointer;
        font-size: 14px;
        transition: background 0.2s;
    `;
    saveBtn.addEventListener('mouseenter', () => {
        saveBtn.style.background = '#1976D2';
    });
    saveBtn.addEventListener('mouseleave', () => {
        saveBtn.style.background = '#2196F3';
    });
    saveBtn.addEventListener('click', saveDrawing);
    
    // 分隔线
    const separator1 = document.createElement('div');
    separator1.style.cssText = `
        width: 1px;
        height: 30px;
        background: #ddd;
        margin: 0 10px;
    `;
    
    // 图层变换按钮组
    const transformLabel = document.createElement('span');
    transformLabel.textContent = '变换:';
    transformLabel.style.cssText = `
        font-size: 14px;
        color: #333;
        font-weight: 500;
    `;
    
    const scaleBtn = document.createElement('button');
    scaleBtn.textContent = '🔍';
    scaleBtn.title = '缩放模式（拖拽缩放）';
    scaleBtn.id = 'scale-mode-btn';
    scaleBtn.style.cssText = `
        padding: 8px 12px;
        background: #9C27B0;
        border: none;
        border-radius: 6px;
        color: white;
        cursor: pointer;
        font-size: 18px;
        transition: background 0.2s;
    `;
    scaleBtn.addEventListener('click', () => toggleTransformMode('scale'));
    
    const rotateBtn = document.createElement('button');
    rotateBtn.textContent = '↻';
    rotateBtn.title = '旋转模式（拖拽旋转）';
    rotateBtn.id = 'rotate-mode-btn';
    rotateBtn.style.cssText = `
        padding: 8px 12px;
        background: #FF9800;
        border: none;
        border-radius: 6px;
        color: white;
        cursor: pointer;
        font-size: 18px;
        transition: background 0.2s;
    `;
    rotateBtn.addEventListener('click', () => toggleTransformMode('rotate'));
    
    const moveBtn = document.createElement('button');
    moveBtn.textContent = '✋';
    moveBtn.title = '移动模式（拖拽移动图层）';
    moveBtn.id = 'move-mode-btn';
    moveBtn.style.cssText = `
        padding: 8px 12px;
        background: #607D8B;
        border: none;
        border-radius: 6px;
        color: white;
        cursor: pointer;
        font-size: 18px;
        transition: background 0.2s;
    `;
    moveBtn.addEventListener('click', () => toggleTransformMode('move'));
    
    const flipHBtn = document.createElement('button');
    flipHBtn.textContent = '↔️';
    flipHBtn.title = '水平镜像';
    flipHBtn.style.cssText = `
        padding: 8px 12px;
        background: #00BCD4;
        border: none;
        border-radius: 6px;
        color: white;
        cursor: pointer;
        font-size: 14px;
        transition: background 0.2s;
    `;
    flipHBtn.addEventListener('mouseenter', () => flipHBtn.style.background = '#0097A7');
    flipHBtn.addEventListener('mouseleave', () => flipHBtn.style.background = '#00BCD4');
    flipHBtn.addEventListener('click', () => flipCurrentLayerH());
    
    const flipVBtn = document.createElement('button');
    flipVBtn.textContent = '↕️';
    flipVBtn.title = '垂直镜像';
    flipVBtn.style.cssText = `
        padding: 8px 12px;
        background: #00BCD4;
        border: none;
        border-radius: 6px;
        color: white;
        cursor: pointer;
        font-size: 14px;
        transition: background 0.2s;
    `;
    flipVBtn.addEventListener('mouseenter', () => flipVBtn.style.background = '#0097A7');
    flipVBtn.addEventListener('mouseleave', () => flipVBtn.style.background = '#00BCD4');
    flipVBtn.addEventListener('click', () => flipCurrentLayerV());
    
    const resetTransformBtn = document.createElement('button');
    resetTransformBtn.textContent = '🔄';
    resetTransformBtn.title = '重置变换';
    resetTransformBtn.style.cssText = `
        padding: 8px 12px;
        background: #607D8B;
        border: none;
        border-radius: 6px;
        color: white;
        cursor: pointer;
        font-size: 14px;
        transition: background 0.2s;
    `;
    resetTransformBtn.addEventListener('mouseenter', () => resetTransformBtn.style.background = '#455A64');
    resetTransformBtn.addEventListener('mouseleave', () => resetTransformBtn.style.background = '#607D8B');
    resetTransformBtn.addEventListener('click', () => resetCurrentLayerTransform());
    
    const undoBtn = document.createElement('button');
    undoBtn.textContent = '↶';
    undoBtn.title = '撤销 (Ctrl+Z)';
    undoBtn.id = 'undo-btn';
    undoBtn.style.cssText = `
        padding: 8px 12px;
        background: #9E9E9E;
        border: none;
        border-radius: 6px;
        color: white;
        cursor: pointer;
        font-size: 18px;
        transition: background 0.2s;
    `;
    undoBtn.addEventListener('click', undo);
    
    const redoBtn = document.createElement('button');
    redoBtn.textContent = '↷';
    redoBtn.title = '重做 (Ctrl+Y)';
    redoBtn.id = 'redo-btn';
    redoBtn.style.cssText = `
        padding: 8px 12px;
        background: #9E9E9E;
        border: none;
        border-radius: 6px;
        color: white;
        cursor: pointer;
        font-size: 18px;
        transition: background 0.2s;
    `;
    redoBtn.addEventListener('click', redo);
    
    // 文本输入按钮
    const textBtn = document.createElement('button');
    textBtn.textContent = '📝';
    textBtn.title = '添加文本';
    textBtn.style.cssText = `
        padding: 8px 12px;
        background: #9C27B0;
        border: none;
        border-radius: 6px;
        color: white;
        cursor: pointer;
        font-size: 14px;
        transition: background 0.2s;
    `;
    textBtn.addEventListener('mouseenter', () => textBtn.style.background = '#7B1FA2');
    textBtn.addEventListener('mouseleave', () => textBtn.style.background = '#9C27B0');
    textBtn.addEventListener('click', showTextInputDialog);
    
    // 导入图片按钮
    const importBtn = document.createElement('button');
    importBtn.textContent = '📁';
    importBtn.title = '导入图片 (或按 Ctrl+V 从剪贴板粘贴)';
    importBtn.style.cssText = `
        padding: 8px 12px;
        background: #FF9800;
        border: none;
        border-radius: 6px;
        color: white;
        cursor: pointer;
        font-size: 14px;
        transition: background 0.2s;
    `;
    importBtn.addEventListener('mouseenter', () => importBtn.style.background = '#F57C00');
    importBtn.addEventListener('mouseleave', () => importBtn.style.background = '#FF9800');
    importBtn.addEventListener('click', importImage);
    
    // 剪贴板粘贴按钮
    const pasteBtn = document.createElement('button');
    pasteBtn.textContent = '📋';
    pasteBtn.title = '从剪贴板粘贴图像 (Ctrl+V)';
    pasteBtn.style.cssText = `
        padding: 8px 12px;
        background: #8BC34A;
        border: none;
        border-radius: 6px;
        color: white;
        cursor: pointer;
        font-size: 14px;
        transition: background 0.2s;
    `;
    pasteBtn.addEventListener('mouseenter', () => pasteBtn.style.background = '#7CB342');
    pasteBtn.addEventListener('mouseleave', () => pasteBtn.style.background = '#8BC34A');
    pasteBtn.addEventListener('click', pasteImageFromClipboard);
    
    // 剪贴板复制按钮
    const copyBtn = document.createElement('button');
    copyBtn.textContent = '📄';
    copyBtn.title = '复制图像到剪贴板 (Ctrl+C)';
    copyBtn.style.cssText = `
        padding: 8px 12px;
        background: #4CAF50;
        border: none;
        border-radius: 6px;
        color: white;
        cursor: pointer;
        font-size: 14px;
        transition: background 0.2s;
    `;
    copyBtn.addEventListener('mouseenter', () => copyBtn.style.background = '#45a049');
    copyBtn.addEventListener('mouseleave', () => copyBtn.style.background = '#4CAF50');
    copyBtn.addEventListener('click', copyImageToClipboard);
    
    // 节点图像导入按钮
    const nodeImportBtn = document.createElement('button');
    nodeImportBtn.textContent = '🔗';
    nodeImportBtn.title = '从节点导入图像';
    nodeImportBtn.style.cssText = `
        padding: 8px 12px;
        background: #9C27B0;
        border: none;
        border-radius: 6px;
        color: white;
        cursor: pointer;
        font-size: 14px;
        transition: background 0.2s;
    `;
    nodeImportBtn.addEventListener('mouseenter', () => nodeImportBtn.style.background = '#7B1FA2');
    nodeImportBtn.addEventListener('mouseleave', () => nodeImportBtn.style.background = '#9C27B0');
    nodeImportBtn.addEventListener('click', importFromNode);
    
    // 节点图像导出按钮
    const nodeExportBtn = document.createElement('button');
    nodeExportBtn.textContent = '📤';
    nodeExportBtn.title = '导出图像到节点';
    nodeExportBtn.style.cssText = `
        padding: 8px 12px;
        background: #00BCD4;
        border: none;
        border-radius: 6px;
        color: white;
        cursor: pointer;
        font-size: 14px;
        transition: background 0.2s;
    `;
    nodeExportBtn.addEventListener('mouseenter', () => nodeExportBtn.style.background = '#0097A7');
    nodeExportBtn.addEventListener('mouseleave', () => nodeExportBtn.style.background = '#00BCD4');
    nodeExportBtn.addEventListener('click', exportToNode);
    
    // 画板尺寸设置按钮
    const canvasSizeBtn = document.createElement('button');
    canvasSizeBtn.textContent = '📐';
    canvasSizeBtn.title = '设置画板尺寸';
    canvasSizeBtn.style.cssText = `
        padding: 8px 12px;
        background: #795548;
        border: none;
        border-radius: 6px;
        color: white;
        cursor: pointer;
        font-size: 14px;
        transition: background 0.2s;
    `;
    canvasSizeBtn.addEventListener('mouseenter', () => canvasSizeBtn.style.background = '#5D4037');
    canvasSizeBtn.addEventListener('mouseleave', () => canvasSizeBtn.style.background = '#795548');
    canvasSizeBtn.addEventListener('click', showCanvasSizeDialog);
    
    // 隐藏的文件输入（稍后添加到 DOM）
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.style.display = 'none';
    fileInput.id = 'hosepen-file-input';
    fileInput.addEventListener('change', handleImageImport);
    // 阻止事件冒泡，防止被 ComfyUI 拦截
    fileInput.addEventListener('click', (e) => e.stopPropagation());
    
    // 分隔线2
    const separator2 = document.createElement('div');
    separator2.style.cssText = `
        width: 1px;
        height: 30px;
        background: #ddd;
        margin: 0 10px;
    `;
    
    // 视图控制标签
    const viewLabel = document.createElement('span');
    viewLabel.textContent = '视图:';
    viewLabel.style.cssText = `
        font-size: 14px;
        color: #333;
        font-weight: 500;
    `;
    
    // 重置视图按钮
    const resetViewBtn = document.createElement('button');
    resetViewBtn.textContent = '🔍';
    resetViewBtn.title = '重置视图 (Ctrl+0)\n滚轮缩放 | 空格+拖拽平移';
    resetViewBtn.style.cssText = `
        padding: 8px 12px;
        background: #009688;
        border: none;
        border-radius: 6px;
        color: white;
        cursor: pointer;
        font-size: 14px;
        transition: background 0.2s;
    `;
    resetViewBtn.addEventListener('mouseenter', () => resetViewBtn.style.background = '#00796B');
    resetViewBtn.addEventListener('mouseleave', () => resetViewBtn.style.background = '#009688');
    resetViewBtn.addEventListener('click', resetView);
    
    // 缩放比例显示
    const zoomDisplay = document.createElement('span');
    zoomDisplay.id = 'zoom-display';
    zoomDisplay.textContent = '100%';
    zoomDisplay.style.cssText = `
        font-size: 12px;
        color: #666;
        min-width: 45px;
        text-align: center;
    `;
    
    toolbar.appendChild(colorPicker);
    toolbar.appendChild(sizeSlider);
    toolbar.appendChild(sizeValue);
    toolbar.appendChild(brushBtn);
    toolbar.appendChild(eraserBtn);
    toolbar.appendChild(bgColorPicker);
    toolbar.appendChild(separator1);
    toolbar.appendChild(transformLabel);
    toolbar.appendChild(scaleBtn);
    toolbar.appendChild(rotateBtn);
    toolbar.appendChild(moveBtn);
    toolbar.appendChild(flipHBtn);
    toolbar.appendChild(flipVBtn);
    toolbar.appendChild(resetTransformBtn);
    toolbar.appendChild(undoBtn);
    toolbar.appendChild(redoBtn);
    toolbar.appendChild(textBtn);
    toolbar.appendChild(importBtn);
    toolbar.appendChild(pasteBtn);
    toolbar.appendChild(copyBtn);
    toolbar.appendChild(nodeImportBtn);
    toolbar.appendChild(nodeExportBtn);
    toolbar.appendChild(canvasSizeBtn);
    toolbar.appendChild(separator2);
    toolbar.appendChild(viewLabel);
    toolbar.appendChild(resetViewBtn);
    toolbar.appendChild(zoomDisplay);
    toolbar.appendChild(clearBtn);
    toolbar.appendChild(saveBtn);
    
    // 主内容区（画布+图层面板）
    const mainContent = document.createElement('div');
    mainContent.style.cssText = `
        flex: 1;
        display: flex;
        overflow: hidden;
    `;
    
    // 画布容器
    const canvasContainer = document.createElement('div');
    canvasContainer.style.cssText = `
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #f0f0f0;
        padding: 20px;
        overflow: hidden;
        position: relative;
    `;
    
    // 创建画布
    canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    canvas.style.cssText = `
        background: white;
        cursor: crosshair;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    `;
    
    ctx = canvas.getContext('2d');
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    // 设置画布背景色（通过CSS）
    canvas.style.background = backgroundColor;
    
    // 画布事件
    canvas.addEventListener('mousedown', handleCanvasMouseDown);
    canvas.addEventListener('mousemove', handleCanvasMouseMove);
    canvas.addEventListener('mouseup', handleCanvasMouseUp);
    canvas.addEventListener('mouseout', handleCanvasMouseUp);
    canvas.addEventListener('wheel', handleCanvasWheel, { passive: false });
    
    canvasContainer.appendChild(canvas);
    
    // 图层面板
    const layerPanel = document.createElement('div');
    layerPanel.id = 'layer-panel';
    layerPanel.style.cssText = `
        width: 200px;
        background: #f5f5f5;
        border-left: 1px solid #ddd;
        display: flex;
        flex-direction: column;
    `;
    
    // 图层面板标题
    const layerPanelHeader = document.createElement('div');
    layerPanelHeader.style.cssText = `
        padding: 15px;
        background: #e0e0e0;
        font-weight: bold;
        font-size: 14px;
        color: #333;
        border-bottom: 1px solid #ccc;
    `;
    layerPanelHeader.textContent = '📚 图层';
    
    // 图层按钮组
    const layerButtons = document.createElement('div');
    layerButtons.style.cssText = `
        padding: 8px;
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 4px;
        border-bottom: 1px solid #ddd;
    `;
    
    const addLayerBtn = document.createElement('button');
    addLayerBtn.textContent = '➕';
    addLayerBtn.title = '新建图层';
    addLayerBtn.style.cssText = `
        padding: 8px;
        background: #4CAF50;
        border: none;
        border-radius: 4px;
        color: white;
        cursor: pointer;
        font-size: 16px;
    `;
    addLayerBtn.addEventListener('click', addLayer);
    
    const deleteLayerBtn = document.createElement('button');
    deleteLayerBtn.textContent = '🗑️';
    deleteLayerBtn.title = '删除图层';
    deleteLayerBtn.style.cssText = `
        padding: 8px;
        background: #f44336;
        border: none;
        border-radius: 4px;
        color: white;
        cursor: pointer;
        font-size: 16px;
    `;
    deleteLayerBtn.addEventListener('click', deleteLayer);
    
    const moveUpBtn = document.createElement('button');
    moveUpBtn.textContent = '⬆️';
    moveUpBtn.title = '上移图层';
    moveUpBtn.style.cssText = `
        padding: 8px;
        background: #2196F3;
        border: none;
        border-radius: 4px;
        color: white;
        cursor: pointer;
        font-size: 16px;
    `;
    moveUpBtn.addEventListener('click', moveLayerUp);
    
    const moveDownBtn = document.createElement('button');
    moveDownBtn.textContent = '⬇️';
    moveDownBtn.title = '下移图层';
    moveDownBtn.style.cssText = `
        padding: 8px;
        background: #2196F3;
        border: none;
        border-radius: 4px;
        color: white;
        cursor: pointer;
        font-size: 16px;
    `;
    moveDownBtn.addEventListener('click', moveLayerDown);
    
    layerButtons.appendChild(addLayerBtn);
    layerButtons.appendChild(deleteLayerBtn);
    layerButtons.appendChild(moveUpBtn);
    layerButtons.appendChild(moveDownBtn);
    
    // 图层列表
    const layerList = document.createElement('div');
    layerList.id = 'layer-list';
    layerList.style.cssText = `
        flex: 1;
        overflow-y: auto;
        padding: 8px;
    `;
    
    layerPanel.appendChild(layerPanelHeader);
    layerPanel.appendChild(layerButtons);
    layerPanel.appendChild(layerList);
    
    mainContent.appendChild(canvasContainer);
    mainContent.appendChild(layerPanel);
    
    // 组装窗口
    drawingWindow.appendChild(header);
    drawingWindow.appendChild(toolbar);
    drawingWindow.appendChild(mainContent);
    drawingWindow.appendChild(fileInput); // 添加文件输入到窗口
    
    // 初始化图层系统
    initLayers();
    
    // 添加窗口拖拽功能
    let isDraggingWindow = false;
    let dragOffsetX = 0;
    let dragOffsetY = 0;
    
    header.addEventListener('mousedown', (e) => {
        if (e.target === closeBtn) return;
        
        isDraggingWindow = true;
        const rect = drawingWindow.getBoundingClientRect();
        dragOffsetX = e.clientX - rect.left;
        dragOffsetY = e.clientY - rect.top;
        header.style.cursor = 'grabbing';
        e.preventDefault();
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!isDraggingWindow) return;
        
        let newLeft = e.clientX - dragOffsetX;
        let newTop = e.clientY - dragOffsetY;
        
        // 移除边界限制，允许窗口移动到屏幕外
        drawingWindow.style.left = newLeft + 'px';
        drawingWindow.style.top = newTop + 'px';
        drawingWindow.style.transform = 'none';
    });
    
    document.addEventListener('mouseup', () => {
        if (isDraggingWindow) {
            isDraggingWindow = false;
            header.style.cursor = 'move';
        }
    });
    
    document.body.appendChild(drawingWindow);
    console.log('[hosepen] 绘画窗口已创建');
}

// 统一的画布鼠标按下事件
function handleCanvasMouseDown(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // 空格键平移模式
    if (isSpacePressed) {
        isPanning = true;
        panStartX = e.clientX;
        panStartY = e.clientY;
        canvas.style.cursor = 'grabbing';
        return;
    }
    
    if (transformMode === 'scale') {
        // 缩放模式 - 检查是否点击了控制点
        const handles = getHandlePositions();
        const handleSize = 25; // 点击检测范围（增大以便更容易点击）
        let clickedHandle = false;
        let minDistance = Infinity;
        let closestHandle = null;
        
        for (const [key, pos] of Object.entries(handles)) {
            const dx = x - pos.x;
            const dy = y - pos.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < minDistance) {
                minDistance = distance;
                closestHandle = key;
            }
            
            if (distance < handleSize) {
                // 点击了控制点 - 准备缩放
                clickedHandle = true;
                draggedHandle = key;
                transformStartX = e.clientX;
                transformStartY = e.clientY;
                
                const layer = layers[currentLayerIndex];
                // 记录当前的缩放值作为初始值
                initialWidth = layer.scaleX || 1;
                initialHeight = layer.scaleY || 1;
                
                canvas.style.cursor = 'nwse-resize';
                console.log('[hosepen] 点击控制点:', key, '距离:', distance.toFixed(2));
                return;
            }
        }
        
        // 如果没有点击控制点，点击任意位置退出缩放模式
        if (!clickedHandle) {
            // 点击了空白处 - 应用变换并退出模式
            console.log('[hosepen] 未点击控制点，最近的是:', closestHandle, '距离:', minDistance.toFixed(2), '点击位置:', x.toFixed(2), y.toFixed(2));
            transformMode = null;
            canvas.style.cursor = 'crosshair';
            updateTransformButtonStates();
            showNotification('✅ 缩放已应用', 'success');
            mergeAndRender();
            return;
        }
    } else if (transformMode === 'rotate') {
        // 旋转模式 - 检查是否点击在内容区域
        if (layers.length > 0) {
            const layer = layers[currentLayerIndex];
            if (!layer.contentBounds) {
                layer.contentBounds = getLayerContentBounds(layer);
            }
            
            const bounds = layer.contentBounds;
            const margin = 20;
            
            // 使用辅助函数计算屏幕坐标
            const screenBounds = getContentBoundsInScreenCoords(layer, bounds, margin);
            const { minX: expandedMinX, minY: expandedMinY, maxX: expandedMaxX, maxY: expandedMaxY } = screenBounds;
            
            // 检查是否点击在内容区域内
            if (x >= expandedMinX && x <= expandedMaxX &&
                y >= expandedMinY && y <= expandedMaxY) {
                // 点击在内容区域 - 开始旋转
                console.log('[hosepen] 旋转模式 - 点击在内容区域内', {
                    click: `(${x.toFixed(1)},${y.toFixed(1)})`,
                    bounds: `(${expandedMinX.toFixed(1)},${expandedMinY.toFixed(1)}) - (${expandedMaxX.toFixed(1)},${expandedMaxY.toFixed(1)})`
                });
                isDraggingTransform = true;
                transformStartX = e.clientX;
                transformStartY = e.clientY;
                initialRotation = layer.rotation;
                
                // 如果没有原始内容，保存当前内容作为原始内容
                if (!layer.originalCanvas) {
                    layer.originalCanvas = document.createElement('canvas');
                    layer.originalCanvas.width = layer.canvas.width;
                    layer.originalCanvas.height = layer.canvas.height;
                    const originalCtx = layer.originalCanvas.getContext('2d');
                    originalCtx.drawImage(layer.canvas, 0, 0);
                }
                
                // 使用原始内容进行旋转
                layerBackup = layer.originalCanvas;
                canvas.style.cursor = 'grabbing';
            } else {
                // 点击在内容区域外 - 退出旋转模式
                transformMode = null;
                canvas.style.cursor = 'crosshair';
                updateTransformButtonStates();
                showNotification('✅ 旋转已应用', 'success');
                mergeAndRender();
            }
        }
    } else if (transformMode === 'move') {
        // 移动模式 - 检查是否点击在内容区域
        if (layers.length > 0) {
            const layer = layers[currentLayerIndex];
            if (!layer.contentBounds) {
                layer.contentBounds = getLayerContentBounds(layer);
            }
            
            const bounds = layer.contentBounds;
            const margin = 20;
            
            // 使用辅助函数计算屏幕坐标
            const screenBounds = getContentBoundsInScreenCoords(layer, bounds, margin);
            const { minX: expandedMinX, minY: expandedMinY, maxX: expandedMaxX, maxY: expandedMaxY } = screenBounds;
            
            // 检查是否点击在内容区域内
            if (x >= expandedMinX && x <= expandedMaxX &&
                y >= expandedMinY && y <= expandedMaxY) {
                // 点击在内容区域 - 开始移动
                console.log('[hosepen] 移动模式 - 点击在内容区域内', {
                    click: `(${x.toFixed(1)},${y.toFixed(1)})`,
                    bounds: `(${expandedMinX.toFixed(1)},${expandedMinY.toFixed(1)}) - (${expandedMaxX.toFixed(1)},${expandedMaxY.toFixed(1)})`
                });
                isDraggingContent = true;
                transformStartX = e.clientX;
                transformStartY = e.clientY;
                initialOffsetX = layer.offsetX;
                initialOffsetY = layer.offsetY;
                
                // 保存所有选中图层的初始偏移量
                initialLayerOffsets = {};
                selectedLayerIndices.forEach(index => {
                    if (index >= 0 && index < layers.length) {
                        initialLayerOffsets[index] = {
                            x: layers[index].offsetX,
                            y: layers[index].offsetY
                        };
                    }
                });
                
                canvas.style.cursor = 'grabbing';
            } else {
                // 点击在内容区域外 - 退出移动模式
                transformMode = null;
                canvas.style.cursor = 'crosshair';
                updateTransformButtonStates();
                showNotification('✅ 移动已完成', 'success');
                mergeAndRender();
            }
        }
    } else {
        // 绘画模式
        isDrawing = true;
        
        // 转换为图层坐标
        const currentLayer = layers[currentLayerIndex];
        const layerCoords = screenToLayerCoords(x, y, currentLayer);
        lastX = layerCoords.x;
        lastY = layerCoords.y;
    }
}

// 统一的画布鼠标移动事件
function handleCanvasMouseMove(e) {
    // 平移视图
    if (isPanning) {
        const deltaX = e.clientX - panStartX;
        const deltaY = e.clientY - panStartY;
        viewOffsetX += deltaX;
        viewOffsetY += deltaY;
        panStartX = e.clientX;
        panStartY = e.clientY;
        mergeAndRender();
        return;
    }
    
    if (draggedHandle) {
        // 检查是否真的拖动了（移动距离超过阈值）
        const deltaX = e.clientX - transformStartX;
        const deltaY = e.clientY - transformStartY;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        
        // 只有移动超过3px才开始缩放
        if (distance > 3) {
            isDraggingTransform = true;
            handleTransformDrag(e);
        }
    } else if (isDraggingContent) {
        // 拖动内容移动位置
        handleContentDrag(e);
    } else if (transformMode && isDraggingTransform) {
        // 旋转模式拖拽
        handleTransformDrag(e);
    } else if (isDrawing) {
        // 绘画模式
        draw(e);
    }
}

// 统一的画布鼠标释放事件
function handleCanvasMouseUp() {
    if (isPanning) {
        isPanning = false;
        canvas.style.cursor = isSpacePressed ? 'grab' : 'crosshair';
    }
    if (isDraggingTransform || draggedHandle) {
        isDraggingTransform = false;
        draggedHandle = null;
        layerBackup = null; // 清除备份
        saveHistory(); // 保存变换历史
        
        if (transformMode === 'scale') {
            canvas.style.cursor = 'crosshair';
        } else if (transformMode === 'rotate') {
            canvas.style.cursor = 'grab';
        }
    }
    if (isDraggingContent) {
        isDraggingContent = false;
        canvas.style.cursor = 'crosshair';
        initialLayerOffsets = {}; // 清理初始偏移量缓存
        saveHistory(); // 保存移动历史
    }
    if (isDrawing) {
        stopDrawing(); // 调用 stopDrawing 来保存历史
    }
}

// 处理变换拖拽
function handleTransformDrag(e) {
    if (layers.length === 0) return;
    
    // 取消之前的动画帧
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
    }
    
    // 使用 requestAnimationFrame 优化渲染
    animationFrameId = requestAnimationFrame(() => {
        performTransformDrag(e);
    });
}

// 执行实际的变换拖拽
function performTransformDrag(e) {
    if (layers.length === 0) return;
    
    const deltaX = e.clientX - transformStartX;
    const deltaY = e.clientY - transformStartY;
    
    if (transformMode === 'scale' && draggedHandle) {
        const layer = layers[currentLayerIndex];
        
        // 第一次拖动时备份图层
        if (!layerBackup) {
            // 如果没有原始内容，保存当前内容作为原始内容
            if (!layer.originalCanvas) {
                layer.originalCanvas = document.createElement('canvas');
                layer.originalCanvas.width = layer.canvas.width;
                layer.originalCanvas.height = layer.canvas.height;
                const originalCtx = layer.originalCanvas.getContext('2d');
                originalCtx.drawImage(layer.canvas, 0, 0);
            }
            
            // 使用原始内容作为备份，而不是当前内容
            layerBackup = layer.originalCanvas;
        }
        
        // 缩放：根据拖动的控制点
        const isCorner = ['nw', 'ne', 'se', 'sw'].includes(draggedHandle);
        
        let newScaleX, newScaleY;
        
        if (isCorner) {
            // 角点 - 等比例缩放
            let scaleDelta = 0;
            
            switch(draggedHandle) {
                case 'nw':
                    scaleDelta = -(deltaX + deltaY) / 2;
                    break;
                case 'ne':
                    scaleDelta = (deltaX - deltaY) / 2;
                    break;
                case 'se':
                    scaleDelta = (deltaX + deltaY) / 2;
                    break;
                case 'sw':
                    scaleDelta = (-deltaX + deltaY) / 2;
                    break;
            }
            
            const scaleFactor = 1 + (scaleDelta / 150);
            newScaleX = Math.max(0.1, initialWidth * scaleFactor);
            newScaleY = Math.max(0.1, initialHeight * scaleFactor);
        } else {
            // 边中点 - 非等比例缩放（所有图层都使用相同逻辑）
            if (draggedHandle === 'n') {
                const scaleFactor = 1 - (deltaY / 150);
                newScaleY = Math.max(0.1, initialHeight * scaleFactor);
                newScaleX = initialWidth;
            } else if (draggedHandle === 's') {
                const scaleFactor = 1 + (deltaY / 150);
                newScaleY = Math.max(0.1, initialHeight * scaleFactor);
                newScaleX = initialWidth;
            } else if (draggedHandle === 'e') {
                const scaleFactor = 1 + (deltaX / 150);
                newScaleX = Math.max(0.1, initialWidth * scaleFactor);
                newScaleY = initialHeight;
            } else if (draggedHandle === 'w') {
                const scaleFactor = 1 - (deltaX / 150);
                newScaleX = Math.max(0.1, initialWidth * scaleFactor);
                newScaleY = initialHeight;
            }
        }
        
        // 更新缩放值
        layer.scaleX = newScaleX;
        layer.scaleY = newScaleY;
        
        // 获取原始内容的边界，找到内容中心
        const tempLayer = { 
            originalCanvas: layerBackup,
            canvas: layerBackup, 
            ctx: layerBackup.getContext('2d') 
        };
        const tempBounds = getLayerContentBounds(tempLayer);
        const contentCenterX = tempBounds.x + tempBounds.width / 2;
        const contentCenterY = tempBounds.y + tempBounds.height / 2;
        
        // 清空当前图层
        layer.ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
        
        // 将备份的内容围绕内容中心缩放和旋转绘制到图层上
        layer.ctx.save();
        layer.ctx.translate(contentCenterX, contentCenterY);
        layer.ctx.rotate(layer.rotation * Math.PI / 180);  // 应用旋转
        layer.ctx.scale(newScaleX, newScaleY);              // 应用缩放
        layer.ctx.translate(-contentCenterX, -contentCenterY);
        layer.ctx.drawImage(layerBackup, 0, 0);
        layer.ctx.restore();
        
        // 更新内容边界
        layer.contentBounds = null;
        
    } else if (transformMode === 'rotate' && isDraggingTransform) {
        const layer = layers[currentLayerIndex];
        
        // 确保有备份
        if (!layerBackup) {
            layerBackup = layer.originalCanvas || layer.canvas;
        }
        
        // 旋转：类似 Photoshop，水平拖动旋转
        const rotationDelta = deltaX * 0.5; // 每移动2px旋转1度
        const newRotation = (initialRotation + rotationDelta) % 360;
        layer.rotation = newRotation;
        
        // 获取原始内容的边界，找到内容中心
        const tempLayer = { 
            originalCanvas: layerBackup,
            canvas: layerBackup, 
            ctx: layerBackup.getContext('2d') 
        };
        const tempBounds = getLayerContentBounds(tempLayer);
        const contentCenterX = tempBounds.x + tempBounds.width / 2;
        const contentCenterY = tempBounds.y + tempBounds.height / 2;
        
        // 清空当前图层
        layer.ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
        
        // 将备份的内容围绕内容中心旋转和缩放绘制到图层上
        layer.ctx.save();
        layer.ctx.translate(contentCenterX, contentCenterY);
        layer.ctx.rotate(newRotation * Math.PI / 180);  // 应用旋转
        layer.ctx.scale(layer.scaleX, layer.scaleY);    // 应用缩放
        layer.ctx.translate(-contentCenterX, -contentCenterY);
        layer.ctx.drawImage(layerBackup, 0, 0);
        layer.ctx.restore();
        
        // 更新内容边界
        layer.contentBounds = null;
    }
    
    mergeAndRender();
}

// 处理内容拖动（移动位置）
function handleContentDrag(e) {
    if (layers.length === 0) return;
    
    // 取消之前的动画帧
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
    }
    
    // 使用 requestAnimationFrame 优化渲染
    animationFrameId = requestAnimationFrame(() => {
        const deltaX = e.clientX - transformStartX;
        const deltaY = e.clientY - transformStartY;
        
        // 应用到所有选中的图层，使用各自的初始偏移量
        selectedLayerIndices.forEach(index => {
            if (index >= 0 && index < layers.length && initialLayerOffsets[index]) {
                const layer = layers[index];
                // 考虑视图缩放的影响，使用该图层自己的初始偏移量
                layer.offsetX = initialLayerOffsets[index].x + deltaX / viewScale;
                layer.offsetY = initialLayerOffsets[index].y + deltaY / viewScale;
            }
        });
        
        mergeAndRender();
    });
}

// 切换变换模式
function toggleTransformMode(mode) {
    // 如果当前有其他变换模式，先应用它
    if (transformMode && transformMode !== mode) {
        // 自动切换到新模式
        transformMode = mode;
        canvas.style.cursor = mode === 'scale' ? 'crosshair' : 'grab';
        updateTransformButtonStates();
        const modeName = mode === 'scale' ? '缩放' : '旋转';
        showNotification(`🔧 已切换到${modeName}模式`, 'info');
        mergeAndRender();
    } else if (transformMode === mode) {
        // 取消当前模式
        transformMode = null;
        canvas.style.cursor = 'crosshair';
        updateTransformButtonStates();
        showNotification('✏️ 已切换到绘画模式', 'info');
        mergeAndRender();
    } else {
        // 激活新模式
        transformMode = mode;
        let cursorStyle = 'crosshair';
        let modeName = '';
        let modeDesc = '';
        
        switch(mode) {
            case 'scale':
                cursorStyle = 'crosshair';
                modeName = '缩放';
                modeDesc = '拖动控制点缩放';
                break;
            case 'rotate':
                cursorStyle = 'grab';
                modeName = '旋转';
                modeDesc = '拖拽画布旋转';
                break;
            case 'move':
                cursorStyle = 'move';
                modeName = '移动';
                modeDesc = '拖拽移动图层位置';
                break;
        }
        
        canvas.style.cursor = cursorStyle;
        updateTransformButtonStates();
        showNotification(`🔧 已切换到${modeName}模式（${modeDesc}）`, 'info');
        mergeAndRender();
    }
}

// 更新变换按钮状态
function updateTransformButtonStates() {
    const scaleBtn = document.getElementById('scale-mode-btn');
    const rotateBtn = document.getElementById('rotate-mode-btn');
    const moveBtn = document.getElementById('move-mode-btn');
    
    if (scaleBtn) {
        scaleBtn.style.background = transformMode === 'scale' ? '#7B1FA2' : '#9C27B0';
        scaleBtn.style.boxShadow = transformMode === 'scale' ? '0 0 10px #9C27B0' : 'none';
    }
    
    if (rotateBtn) {
        rotateBtn.style.background = transformMode === 'rotate' ? '#F57C00' : '#FF9800';
        rotateBtn.style.boxShadow = transformMode === 'rotate' ? '0 0 10px #FF9800' : 'none';
    }
    
    if (moveBtn) {
        moveBtn.style.background = transformMode === 'move' ? '#455A64' : '#607D8B';
        moveBtn.style.boxShadow = transformMode === 'move' ? '0 0 10px #607D8B' : 'none';
    }
}

// 将屏幕坐标转换为图层坐标
function screenToLayerCoords(screenX, screenY, layer) {
    // 先应用视图变换的逆变换
    let x = (screenX - viewOffsetX - canvas.width / 2) / viewScale;
    let y = (screenY - viewOffsetY - canvas.height / 2) / viewScale;
    
    // 减去图层偏移
    x -= layer.offsetX;
    y -= layer.offsetY;
    
    // 转换回图层画布坐标系
    x += canvas.width / 2;
    y += canvas.height / 2;
    
    return { x, y };
}

// 开始绘画
function startDrawing(e) {
    isDrawing = true;
    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    
    // 转换为图层坐标
    const currentLayer = layers[currentLayerIndex];
    const layerCoords = screenToLayerCoords(screenX, screenY, currentLayer);
    lastX = layerCoords.x;
    lastY = layerCoords.y;
}

// 绘画
function draw(e) {
    if (!isDrawing || layers.length === 0) return;
    
    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    
    // 在当前图层上绘制
    const currentLayer = layers[currentLayerIndex];
    const layerCtx = currentLayer.ctx;
    
    // 转换为图层坐标
    const layerCoords = screenToLayerCoords(screenX, screenY, currentLayer);
    const currentX = layerCoords.x;
    const currentY = layerCoords.y;
    
    if (isEraser) {
        // 橡皮擦模式
        layerCtx.globalCompositeOperation = 'destination-out';
        layerCtx.strokeStyle = 'rgba(0,0,0,1)';
        layerCtx.lineWidth = currentSize;
    } else {
        // 画笔模式
        layerCtx.globalCompositeOperation = 'source-over';
        layerCtx.strokeStyle = currentColor;
        layerCtx.lineWidth = currentSize;
    }
    
    layerCtx.beginPath();
    layerCtx.moveTo(lastX, lastY);
    layerCtx.lineTo(currentX, currentY);
    layerCtx.stroke();
    
    lastX = currentX;
    lastY = currentY;
    
    // 更新内容边界
    currentLayer.contentBounds = null;
    
    // 合并所有图层到主画布
    mergeAndRender();
}

// 停止绘画
function stopDrawing() {
    if (isDrawing) {
        isDrawing = false;
        
        // 更新原始内容
        if (layers.length > 0) {
            const currentLayer = layers[currentLayerIndex];
            if (!currentLayer.originalCanvas) {
                currentLayer.originalCanvas = document.createElement('canvas');
                currentLayer.originalCanvas.width = currentLayer.canvas.width;
                currentLayer.originalCanvas.height = currentLayer.canvas.height;
            }
            const originalCtx = currentLayer.originalCanvas.getContext('2d');
            originalCtx.clearRect(0, 0, currentLayer.originalCanvas.width, currentLayer.originalCanvas.height);
            originalCtx.drawImage(currentLayer.canvas, 0, 0);
        }
        
        saveHistory(); // 保存历史
    }
}

// 清空画布
function clearCanvas() {
    if (confirm('确定要清空当前图层吗？')) {
        if (layers.length > 0) {
            const currentLayer = layers[currentLayerIndex];
            currentLayer.ctx.clearRect(0, 0, currentLayer.canvas.width, currentLayer.canvas.height);
            mergeAndRender();
        }
    }
}

// 保存绘画
function saveDrawing() {
    // 创建临时画布，包含背景色和所有图层
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    
    // 先填充背景色
    tempCtx.fillStyle = backgroundColor;
    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
    
    // 绘制所有可见图层
    for (let i = 0; i < layers.length; i++) {
        const layer = layers[i];
        if (layer.visible) {
            tempCtx.globalAlpha = layer.opacity;
            tempCtx.drawImage(layer.canvas, 0, 0);
        }
    }
    
    tempCtx.globalAlpha = 1;
    
    // 导出为图片
    const dataURL = tempCanvas.toDataURL('image/png');
    
    // 下载图片
    const link = document.createElement('a');
    link.download = `hosepen_drawing_${Date.now()}.png`;
    link.href = dataURL;
    link.click();
    
    // 显示提示
    showNotification('✅ 绘画已保存', 'success');
}

// 显示通知
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
        color: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        z-index: 10001;
        font-size: 14px;
        animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 2000);
}

// 添加动画样式
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// ========== 图层系统函数 ==========

// 初始化图层系统
function initLayers() {
    // 创建初始图层，但不显示通知
    const layerCanvas = document.createElement('canvas');
    layerCanvas.width = canvas.width;
    layerCanvas.height = canvas.height;
    
    const layer = {
        id: layerIdCounter++,
        name: `图层 1`,
        canvas: layerCanvas,
        ctx: layerCanvas.getContext('2d'),
        visible: true,
        opacity: 1,
        blendMode: 'normal',
        // 变换属性
        scale: 1,
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
        flipH: false,
        flipV: false,
        offsetX: 0,
        offsetY: 0,
        // 内容边界
        contentBounds: null,
        // 保存原始内容用于无损变换
        originalCanvas: null
    };
    
    layer.ctx.lineCap = 'round';
    layer.ctx.lineJoin = 'round';
    
    layers.push(layer);
    currentLayerIndex = 0;
    selectedLayerIndices = [0];
    
    // 立即渲染图层列表
    renderLayerList();
    
    // 保存初始状态
    saveHistory();
    
    console.log('[hosepen] 初始图层已创建并显示');
}

// 创建新图层
function addLayer() {
    const layerCanvas = document.createElement('canvas');
    layerCanvas.width = canvas.width;
    layerCanvas.height = canvas.height;
    
    const layer = {
        id: layerIdCounter++,
        name: `图层 ${layers.length + 1}`,
        canvas: layerCanvas,
        ctx: layerCanvas.getContext('2d'),
        visible: true,
        opacity: 1,
        blendMode: 'normal', // 混合模式
        // 变换属性
        scale: 1,
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
        flipH: false,
        flipV: false,
        offsetX: 0,
        offsetY: 0,
        // 内容边界
        contentBounds: null,
        // 保存原始内容用于无损变换
        originalCanvas: null
    };
    
    layer.ctx.lineCap = 'round';
    layer.ctx.lineJoin = 'round';
    
    layers.push(layer);
    currentLayerIndex = layers.length - 1;
    
    renderLayerList();
    showNotification(`✅ 已创建 ${layer.name}`, 'success');
}

// 删除图层
function deleteLayer() {
    if (layers.length <= 1) {
        showNotification('⚠️ 至少需要保留一个图层', 'warning');
        return;
    }
    
    const layerName = layers[currentLayerIndex].name;
    layers.splice(currentLayerIndex, 1);
    
    if (currentLayerIndex >= layers.length) {
        currentLayerIndex = layers.length - 1;
    }
    
    renderLayerList();
    mergeAndRender();
    showNotification(`✅ 已删除 ${layerName}`, 'success');
}

// 上移图层
function moveLayerUp() {
    if (currentLayerIndex >= layers.length - 1) {
        showNotification('⚠️ 图层已在最顶层', 'warning');
        return;
    }
    
    const layerName = layers[currentLayerIndex].name;
    
    // 交换图层位置
    const temp = layers[currentLayerIndex];
    layers[currentLayerIndex] = layers[currentLayerIndex + 1];
    layers[currentLayerIndex + 1] = temp;
    
    // 更新当前图层索引
    currentLayerIndex = currentLayerIndex + 1;
    
    // 更新选中状态
    selectedLayerIndices = [currentLayerIndex];
    
    renderLayerList();
    mergeAndRender();
    saveHistory();
    showNotification(`✅ ${layerName} 已上移`, 'success');
}

// 下移图层
function moveLayerDown() {
    if (currentLayerIndex <= 0) {
        showNotification('⚠️ 图层已在最底层', 'warning');
        return;
    }
    
    const layerName = layers[currentLayerIndex].name;
    
    // 交换图层位置
    const temp = layers[currentLayerIndex];
    layers[currentLayerIndex] = layers[currentLayerIndex - 1];
    layers[currentLayerIndex - 1] = temp;
    
    // 更新当前图层索引
    currentLayerIndex = currentLayerIndex - 1;
    
    // 更新选中状态
    selectedLayerIndices = [currentLayerIndex];
    
    renderLayerList();
    mergeAndRender();
    saveHistory();
    showNotification(`✅ ${layerName} 已下移`, 'success');
}

// 切换图层
function selectLayer(index) {
    currentLayerIndex = index;
    selectedLayerIndices = [index]; // 单选时只选中当前图层
    renderLayerList();
}

// 切换图层可见性
function toggleLayerVisibility(index) {
    layers[index].visible = !layers[index].visible;
    renderLayerList();
    mergeAndRender();
}

// 更新图层透明度
function updateLayerOpacity(index, opacity) {
    if (index >= 0 && index < layers.length) {
        layers[index].opacity = Math.max(0, Math.min(1, opacity));
        mergeAndRender();
    }
}

// 更新图层混合模式
function updateLayerBlendMode(index, blendMode) {
    if (index >= 0 && index < layers.length) {
        layers[index].blendMode = blendMode;
        mergeAndRender();
    }
}

// 渲染图层列表
function renderLayerList() {
    const layerList = document.getElementById('layer-list');
    if (!layerList) return;
    
    layerList.innerHTML = '';
    
    // 从上到下显示图层（倒序）
    for (let i = layers.length - 1; i >= 0; i--) {
        const layer = layers[i];
        const layerItem = document.createElement('div');
        layerItem.style.cssText = `
            padding: 8px;
            margin-bottom: 5px;
            background: ${i === currentLayerIndex ? '#4CAF50' : '#ffffff'};
            color: ${i === currentLayerIndex ? 'white' : '#333'};
            border: 1px solid #ddd;
            border-radius: 4px;
            cursor: pointer;
            transition: background 0.2s;
        `;
        
        // 第一行：主要信息
        const topRow = document.createElement('div');
        topRow.style.cssText = `
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 6px;
        `;
        
        // 复选框（多选）
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = selectedLayerIndices.includes(i);
        checkbox.style.cssText = `
            cursor: pointer;
            width: 16px;
            height: 16px;
        `;
        checkbox.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleLayerSelection(i, e.ctrlKey || e.metaKey);
        });
        
        // 可见性按钮
        const visibilityBtn = document.createElement('span');
        visibilityBtn.textContent = layer.visible ? '👁️' : '🚫';
        visibilityBtn.style.cssText = `
            cursor: pointer;
            font-size: 16px;
        `;
        visibilityBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleLayerVisibility(i);
        });
        
        // 图层名称
        const layerName = document.createElement('span');
        layerName.textContent = layer.name;
        layerName.style.cssText = `
            flex: 1;
            font-size: 13px;
            font-weight: 500;
        `;
        
        // 文本颜色编辑按钮（仅对文本图层显示）
        if (layer.isTextLayer) {
            const colorEditBtn = document.createElement('button');
            colorEditBtn.textContent = '🎨';
            colorEditBtn.title = '修改文本颜色';
            colorEditBtn.style.cssText = `
                width: 24px;
                height: 24px;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 12px;
                background: ${layer.fontColor};
                color: white;
                text-shadow: 1px 1px 1px rgba(0,0,0,0.5);
                transition: transform 0.2s;
            `;
            colorEditBtn.addEventListener('mouseenter', () => {
                colorEditBtn.style.transform = 'scale(1.1)';
            });
            colorEditBtn.addEventListener('mouseleave', () => {
                colorEditBtn.style.transform = 'scale(1)';
            });
            colorEditBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                showTextColorEditDialog(i);
            });
            topRow.appendChild(colorEditBtn);
        }
        
        topRow.appendChild(checkbox);
        topRow.appendChild(visibilityBtn);
        topRow.appendChild(layerName);
        
        // 第二行：控制项
        const bottomRow = document.createElement('div');
        bottomRow.style.cssText = `
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 4px 0;
            background: ${i === currentLayerIndex ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'};
            border-radius: 3px;
            padding: 4px 6px;
        `;
        bottomRow.addEventListener('click', (e) => e.stopPropagation());
        
        // 透明度标签
        const opacityLabel = document.createElement('span');
        opacityLabel.textContent = '透明度:';
        opacityLabel.style.cssText = `
            font-size: 11px;
            color: ${i === currentLayerIndex ? 'rgba(255,255,255,0.9)' : '#666'};
            min-width: 40px;
        `;
        
        // 透明度滑块
        const opacitySlider = document.createElement('input');
        opacitySlider.type = 'range';
        opacitySlider.min = '0';
        opacitySlider.max = '100';
        opacitySlider.value = Math.round(layer.opacity * 100);
        opacitySlider.style.cssText = `
            flex: 1;
            height: 4px;
            min-width: 60px;
        `;
        opacitySlider.addEventListener('input', (e) => {
            e.stopPropagation();
            updateLayerOpacity(i, parseInt(e.target.value) / 100);
            opacityValue.textContent = e.target.value + '%';
        });
        
        // 透明度值显示
        const opacityValue = document.createElement('span');
        opacityValue.textContent = Math.round(layer.opacity * 100) + '%';
        opacityValue.style.cssText = `
            font-size: 11px;
            min-width: 35px;
            color: ${i === currentLayerIndex ? 'rgba(255,255,255,0.9)' : '#666'};
            font-weight: 500;
        `;
        
        bottomRow.appendChild(opacityLabel);
        bottomRow.appendChild(opacitySlider);
        bottomRow.appendChild(opacityValue);
        
        // 混合模式选择器
        const blendModeSelect = document.createElement('select');
        blendModeSelect.style.cssText = `
            font-size: 11px;
            padding: 2px 4px;
            border: 1px solid #ddd;
            border-radius: 3px;
            background: white;
            color: #333;
            cursor: pointer;
        `;
        blendModeSelect.addEventListener('click', (e) => e.stopPropagation());
        blendModeSelect.addEventListener('change', (e) => {
            e.stopPropagation();
            updateLayerBlendMode(i, e.target.value);
        });
        
        // Photoshop 常用混合模式
        const blendModes = [
            { value: 'normal', label: '正常' },
            { value: 'multiply', label: '正片叠底' },
            { value: 'screen', label: '滤色' },
            { value: 'overlay', label: '叠加' },
            { value: 'darken', label: '变暗' },
            { value: 'lighten', label: '变亮' },
            { value: 'color-dodge', label: '颜色减淡' },
            { value: 'color-burn', label: '颜色加深' },
            { value: 'hard-light', label: '强光' },
            { value: 'soft-light', label: '柔光' },
            { value: 'difference', label: '差值' },
            { value: 'exclusion', label: '排除' },
            { value: 'hue', label: '色相' },
            { value: 'saturation', label: '饱和度' },
            { value: 'color', label: '颜色' },
            { value: 'luminosity', label: '明度' }
        ];
        
        blendModes.forEach(mode => {
            const option = document.createElement('option');
            option.value = mode.value;
            option.textContent = mode.label;
            if (layer.blendMode === mode.value) {
                option.selected = true;
            }
            blendModeSelect.appendChild(option);
        });
        
        // 第三行：混合模式
        const blendRow = document.createElement('div');
        blendRow.style.cssText = `
            display: flex;
            align-items: center;
            gap: 8px;
            margin-top: 4px;
        `;
        blendRow.addEventListener('click', (e) => e.stopPropagation());
        
        const blendLabel = document.createElement('span');
        blendLabel.textContent = '混合:';
        blendLabel.style.cssText = `
            font-size: 11px;
            color: ${i === currentLayerIndex ? 'rgba(255,255,255,0.9)' : '#666'};
            min-width: 40px;
        `;
        
        blendRow.appendChild(blendLabel);
        blendRow.appendChild(blendModeSelect);
        
        // 组装图层项
        layerItem.appendChild(topRow);
        layerItem.appendChild(bottomRow);
        layerItem.appendChild(blendRow);
        
        layerItem.addEventListener('click', (e) => {
            if (e.ctrlKey || e.metaKey) {
                toggleLayerSelection(i, true);
            } else {
                selectLayer(i);
            }
        });
        
        layerList.appendChild(layerItem);
    }
}

// 合并所有图层并渲染到主画布
function mergeAndRender() {
    // 清空主画布
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 应用视图变换
    ctx.save();
    ctx.translate(canvas.width / 2 + viewOffsetX, canvas.height / 2 + viewOffsetY);
    ctx.scale(viewScale, viewScale);
    ctx.translate(-canvas.width / 2, -canvas.height / 2);
    
    // 绘制画板背景（使用背景颜色）
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // 绘制画板边界（浅灰色）
    ctx.strokeStyle = '#cccccc';
    ctx.lineWidth = 1 / viewScale; // 根据缩放调整线宽，保持视觉一致
    ctx.strokeRect(0, 0, canvas.width, canvas.height);
    
    // 从下到上绘制所有可见图层
    for (let i = 0; i < layers.length; i++) {
        const layer = layers[i];
        if (layer.visible) {
            ctx.save();
            
            // 设置透明度和混合模式
            ctx.globalAlpha = layer.opacity;
            ctx.globalCompositeOperation = layer.blendMode;
            
            // 移动到画布中心
            ctx.translate(canvas.width / 2, canvas.height / 2);
            
            // 应用偏移
            ctx.translate(layer.offsetX, layer.offsetY);
            
            // 应用镜像（缩放和旋转已经在图层内容上了）
            const flipX = layer.flipH ? -1 : 1;
            const flipY = layer.flipV ? -1 : 1;
            ctx.scale(flipX, flipY);
            
            // 绘制图层（从中心点绘制）
            ctx.drawImage(layer.canvas, -canvas.width / 2, -canvas.height / 2);
            
            ctx.restore();
        }
    }
    
    // 如果在变换模式，绘制变换控制框（在视图变换上下文中）
    if (transformMode && layers.length > 0) {
        drawTransformControls();
    }
    
    ctx.restore();
    ctx.globalAlpha = 1;
    
    // 在画布右上角显示图层信息（在视图变换之外）
    if (transformMode && layers.length > 0) {
        const selectedCount = selectedLayerIndices.length;
        const infoText = selectedCount > 1 
            ? `已选中 ${selectedCount} 个图层` 
            : `图层: ${layers[currentLayerIndex].name}`;
        
        const infoWidth = 160;
        const infoHeight = 30;
        const padding = 10;
        const x = canvas.width - infoWidth - padding;
        const y = padding + 60; // 向下移动60像素
        
        // 半透明背景
        ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
        ctx.fillRect(x, y, infoWidth, infoHeight);
        
        // 边框
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, infoWidth, infoHeight);
        
        // 文字
        ctx.fillStyle = '#ffffff';
        ctx.font = '12px Arial';
        ctx.fillText(infoText, x + 8, y + 20);
    }
}

// 绘制变换控制框
function drawTransformControls() {
    const layer = layers[currentLayerIndex];
    if (!layer.visible) return;
    
    // 每次都重新计算内容边界，因为缩放/旋转会改变边界
    layer.contentBounds = getLayerContentBounds(layer);
    const bounds = layer.contentBounds;
    
    ctx.save();
    
    // 移动到画布中心
    ctx.translate(canvas.width / 2, canvas.height / 2);
    
    // 应用偏移
    ctx.translate(layer.offsetX, layer.offsetY);
    
    // 应用镜像
    const flipX = layer.flipH ? -1 : 1;
    const flipY = layer.flipV ? -1 : 1;
    ctx.scale(flipX, flipY);
    
    // 使用内容边界而不是整个画布，并应用缩放
    const boundsCenterX = bounds.x + bounds.width / 2 - canvas.width / 2;
    const boundsCenterY = bounds.y + bounds.height / 2 - canvas.height / 2;
    const scaledWidth = bounds.width * (layer.scaleX || 1);
    const scaledHeight = bounds.height * (layer.scaleY || 1);
    const halfWidth = scaledWidth / 2;
    const halfHeight = scaledHeight / 2;
    
    // 移动到内容中心
    ctx.translate(boundsCenterX, boundsCenterY);
    
    // 应用旋转（让边界框跟随图层旋转）
    ctx.rotate(layer.rotation * Math.PI / 180);
    
    // 边界框线条（线宽和虚线需要根据视图缩放调整）
    ctx.strokeStyle = '#2196F3';
    ctx.lineWidth = 2 / viewScale;
    ctx.setLineDash([10 / viewScale, 5 / viewScale]);
    ctx.strokeRect(-halfWidth, -halfHeight, scaledWidth, scaledHeight);
    ctx.setLineDash([]);
    
    const handleSize = 12 / viewScale; // 增大控制点视觉大小
    
    // 8个控制点位置（基于内容边界）
    const handles = {
        'nw': [-halfWidth, -halfHeight],      // 左上角
        'n':  [0, -halfHeight],               // 上中
        'ne': [halfWidth, -halfHeight],       // 右上角
        'e':  [halfWidth, 0],                 // 右中
        'se': [halfWidth, halfHeight],        // 右下角
        's':  [0, halfHeight],                // 下中
        'sw': [-halfWidth, halfHeight],       // 左下角
        'w':  [-halfWidth, 0]                 // 左中
    };
    
    // 绘制控制点
    Object.entries(handles).forEach(([key, [x, y]]) => {
        // 角点用方形，边中点用圆形
        const isCorner = ['nw', 'ne', 'se', 'sw'].includes(key);
        
        ctx.fillStyle = '#2196F3';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2 / viewScale;
        
        if (isCorner) {
            // 角点 - 方形
            ctx.fillRect(x - handleSize/2, y - handleSize/2, handleSize, handleSize);
            ctx.strokeRect(x - handleSize/2, y - handleSize/2, handleSize, handleSize);
        } else {
            // 边中点 - 圆形
            ctx.beginPath();
            ctx.arc(x, y, handleSize/2, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        }
    });
    
    // 绘制中心锚点（旋转用）
    if (transformMode === 'rotate') {
        ctx.fillStyle = '#FF9800';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2 / viewScale;
        ctx.beginPath();
        ctx.arc(0, 0, handleSize/2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        // 中心十字线
        ctx.strokeStyle = '#FF9800';
        const crossSize = 15 / viewScale;
        ctx.beginPath();
        ctx.moveTo(-crossSize, 0);
        ctx.lineTo(crossSize, 0);
        ctx.moveTo(0, -crossSize);
        ctx.lineTo(0, crossSize);
        ctx.stroke();
    }
    
    ctx.restore();
}

// 计算图层内容的边界
function getLayerContentBounds(layer) {
    // 如果有原始画布，使用原始画布计算边界（避免旋转影响）
    const sourceCanvas = layer.originalCanvas || layer.canvas;
    const sourceCtx = sourceCanvas.getContext('2d');
    const imageData = sourceCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
    const data = imageData.data;
    
    let minX = sourceCanvas.width;
    let minY = sourceCanvas.height;
    let maxX = 0;
    let maxY = 0;
    
    // 扫描所有像素找到非透明区域
    for (let y = 0; y < sourceCanvas.height; y++) {
        for (let x = 0; x < sourceCanvas.width; x++) {
            const index = (y * sourceCanvas.width + x) * 4;
            const alpha = data[index + 3];
            
            if (alpha > 0) {
                minX = Math.min(minX, x);
                minY = Math.min(minY, y);
                maxX = Math.max(maxX, x);
                maxY = Math.max(maxY, y);
            }
        }
    }
    
    // 如果没有内容，返回默认边界
    if (minX > maxX) {
        return {
            x: sourceCanvas.width / 2 - 50,
            y: sourceCanvas.height / 2 - 50,
            width: 100,
            height: 100
        };
    }
    
    // 添加一些边距
    const padding = 10;
    return {
        x: Math.max(0, minX - padding),
        y: Math.max(0, minY - padding),
        width: Math.min(sourceCanvas.width, maxX - minX + padding * 2),
        height: Math.min(sourceCanvas.height, maxY - minY + padding * 2)
    };
}

// 计算内容边界在屏幕坐标系中的位置（辅助函数）
function getContentBoundsInScreenCoords(layer, bounds, margin = 0) {
    // 计算内容中心在图层坐标系中的位置（相对于画布中心）
    const boundsCenterX = bounds.x + bounds.width / 2 - canvas.width / 2;
    const boundsCenterY = bounds.y + bounds.height / 2 - canvas.height / 2;
    
    // 应用镜像
    const flipX = layer.flipH ? -1 : 1;
    const flipY = layer.flipV ? -1 : 1;
    const flippedBoundsCenterX = boundsCenterX * flipX;
    const flippedBoundsCenterY = boundsCenterY * flipY;
    
    // 图层坐标系中的内容中心位置
    const layerCenterX = canvas.width / 2 + layer.offsetX + flippedBoundsCenterX;
    const layerCenterY = canvas.height / 2 + layer.offsetY + flippedBoundsCenterY;
    
    // 应用视图变换
    const worldCenterX = (layerCenterX - canvas.width / 2) * viewScale + canvas.width / 2 + viewOffsetX;
    const worldCenterY = (layerCenterY - canvas.height / 2) * viewScale + canvas.height / 2 + viewOffsetY;
    
    const halfWidth = bounds.width / 2 * (layer.scaleX || 1) * viewScale;
    const halfHeight = bounds.height / 2 * (layer.scaleY || 1) * viewScale;
    const expandedMargin = margin * viewScale;
    
    // 如果有旋转，计算旋转后的四个角点
    if (layer.rotation !== 0) {
        const rotation = layer.rotation * Math.PI / 180;
        const cos = Math.cos(rotation);
        const sin = Math.sin(rotation);
        
        // 四个角点（相对于中心）
        const corners = [
            [-halfWidth - expandedMargin, -halfHeight - expandedMargin], // 左上
            [halfWidth + expandedMargin, -halfHeight - expandedMargin],  // 右上
            [halfWidth + expandedMargin, halfHeight + expandedMargin],   // 右下
            [-halfWidth - expandedMargin, halfHeight + expandedMargin]   // 左下
        ];
        
        // 旋转所有角点
        const rotatedCorners = corners.map(([x, y]) => {
            return [
                worldCenterX + x * cos - y * sin,
                worldCenterY + x * sin + y * cos
            ];
        });
        
        // 找到旋转后的边界框
        const xs = rotatedCorners.map(c => c[0]);
        const ys = rotatedCorners.map(c => c[1]);
        
        return {
            minX: Math.min(...xs),
            minY: Math.min(...ys),
            maxX: Math.max(...xs),
            maxY: Math.max(...ys),
            centerX: worldCenterX,
            centerY: worldCenterY,
            halfWidth: halfWidth,
            halfHeight: halfHeight,
            rotation: layer.rotation,
            rotatedCorners: rotatedCorners
        };
    }
    
    return {
        minX: worldCenterX - halfWidth - expandedMargin,
        minY: worldCenterY - halfHeight - expandedMargin,
        maxX: worldCenterX + halfWidth + expandedMargin,
        maxY: worldCenterY + halfHeight + expandedMargin,
        centerX: worldCenterX,
        centerY: worldCenterY,
        halfWidth: halfWidth,
        halfHeight: halfHeight
    };
}

// 获取控制点在画布坐标系中的位置
function getHandlePositions() {
    const layer = layers[currentLayerIndex];
    
    // 获取或计算内容边界
    if (!layer.contentBounds) {
        layer.contentBounds = getLayerContentBounds(layer);
    }
    
    const bounds = layer.contentBounds;
    
    // 使用辅助函数计算屏幕坐标
    const screenBounds = getContentBoundsInScreenCoords(layer, bounds, 0);
    const { centerX, centerY, halfWidth, halfHeight } = screenBounds;
    
    const handles = {};
    
    // 如果有旋转，计算旋转后的控制点位置
    if (layer.rotation !== 0) {
        const rotation = layer.rotation * Math.PI / 180;
        const cos = Math.cos(rotation);
        const sin = Math.sin(rotation);
        
        // 8个控制点的相对位置（相对于中心）
        const relativePositions = {
            'nw': [-halfWidth, -halfHeight],
            'n':  [0, -halfHeight],
            'ne': [halfWidth, -halfHeight],
            'e':  [halfWidth, 0],
            'se': [halfWidth, halfHeight],
            's':  [0, halfHeight],
            'sw': [-halfWidth, halfHeight],
            'w':  [-halfWidth, 0]
        };
        
        // 旋转每个控制点
        Object.entries(relativePositions).forEach(([key, [x, y]]) => {
            handles[key] = {
                x: centerX + x * cos - y * sin,
                y: centerY + x * sin + y * cos
            };
        });
    } else {
        // 没有旋转，使用简单的矩形位置
        const { minX, minY, maxX, maxY } = screenBounds;
        const positions = {
            'nw': [minX, minY],
            'n':  [centerX, minY],
            'ne': [maxX, minY],
            'e':  [maxX, centerY],
            'se': [maxX, maxY],
            's':  [centerX, maxY],
            'sw': [minX, maxY],
            'w':  [minX, centerY]
        };
        
        Object.entries(positions).forEach(([key, [x, y]]) => {
            handles[key] = { x, y };
        });
    }
    
    // 调试日志
    console.log('[hosepen] 控制点位置:', {
        view: `scale=${viewScale.toFixed(2)} offset=(${viewOffsetX.toFixed(1)},${viewOffsetY.toFixed(1)})`,
        layer: `offset=(${layer.offsetX.toFixed(1)},${layer.offsetY.toFixed(1)}) rotation=${layer.rotation.toFixed(1)}°`,
        bounds: `size=${bounds.width.toFixed(0)}x${bounds.height.toFixed(0)}`,
        world: `center=(${centerX.toFixed(1)},${centerY.toFixed(1)})`,
        nw: `(${handles.nw.x.toFixed(1)},${handles.nw.y.toFixed(1)})`,
        se: `(${handles.se.x.toFixed(1)},${handles.se.y.toFixed(1)})`
    });
    
    return handles;
}

// 水平镜像当前图层
function flipCurrentLayerH() {
    if (layers.length === 0) return;
    
    // 应用到所有选中的图层
    selectedLayerIndices.forEach(index => {
        if (index >= 0 && index < layers.length) {
            layers[index].flipH = !layers[index].flipH;
        }
    });
    mergeAndRender();
    const count = selectedLayerIndices.length;
    showNotification(`↔️ 已水平镜像 ${count} 个图层`, 'info');
}

// 垂直镜像当前图层
function flipCurrentLayerV() {
    if (layers.length === 0) return;
    
    // 应用到所有选中的图层
    selectedLayerIndices.forEach(index => {
        if (index >= 0 && index < layers.length) {
            layers[index].flipV = !layers[index].flipV;
        }
    });
    mergeAndRender();
    const count = selectedLayerIndices.length;
    showNotification(`↕️ 已垂直镜像 ${count} 个图层`, 'info');
}

// 重置当前图层变换
function resetCurrentLayerTransform() {
    if (layers.length === 0) return;
    
    // 应用到所有选中的图层
    selectedLayerIndices.forEach(index => {
        if (index >= 0 && index < layers.length) {
            const layer = layers[index];
            layer.scale = 1;
            layer.scaleX = 1;
            layer.scaleY = 1;
            layer.rotation = 0;
            layer.flipH = false;
            layer.flipV = false;
            layer.offsetX = 0;
            layer.offsetY = 0;
        }
    });
    mergeAndRender();
    const count = selectedLayerIndices.length;
    showNotification(`🔄 已重置 ${count} 个图层的变换`, 'success');
}

// 鼠标滚轮缩放视图
function handleCanvasWheel(e) {
    e.preventDefault();
    
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // 计算缩放前鼠标在画布坐标系中的位置
    const worldX = (mouseX - viewOffsetX - canvas.width / 2) / viewScale;
    const worldY = (mouseY - viewOffsetY - canvas.height / 2) / viewScale;
    
    // 缩放因子
    const scaleFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.max(0.1, Math.min(10, viewScale * scaleFactor));
    
    // 更新缩放
    viewScale = newScale;
    
    // 调整偏移以保持鼠标位置不变
    viewOffsetX = mouseX - (worldX * viewScale + canvas.width / 2);
    viewOffsetY = mouseY - (worldY * viewScale + canvas.height / 2);
    
    updateZoomDisplay();
    mergeAndRender();
}

// 重置视图
function resetView() {
    viewScale = 1;
    viewOffsetX = 0;
    viewOffsetY = 0;
    updateZoomDisplay();
    mergeAndRender();
    showNotification('🔄 视图已重置', 'info');
}

// 更新缩放比例显示
function updateZoomDisplay() {
    const zoomDisplay = document.getElementById('zoom-display');
    if (zoomDisplay) {
        zoomDisplay.textContent = Math.round(viewScale * 100) + '%';
    }
}

// 页面加载完成后初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
            createButton();
        }, 1000);
    });
} else {
    setTimeout(() => {
        createButton();
    }, 1000);
}

// 撤销/重做功能
function saveHistory() {
    console.log('[hosepen] 保存历史，当前索引:', historyIndex, '栈长度:', historyStack.length);
    
    // 删除当前索引之后的所有历史
    historyStack = historyStack.slice(0, historyIndex + 1);
    
    // 保存当前状态
    const state = {
        layers: layers.map(layer => ({
            id: layer.id,
            name: layer.name,
            visible: layer.visible,
            opacity: layer.opacity,
            scaleX: layer.scaleX,
            scaleY: layer.scaleY,
            rotation: layer.rotation,
            flipH: layer.flipH,
            flipV: layer.flipV,
            offsetX: layer.offsetX,
            offsetY: layer.offsetY,
            imageData: layer.ctx.getImageData(0, 0, layer.canvas.width, layer.canvas.height),
            originalImageData: layer.originalCanvas ? 
                layer.originalCanvas.getContext('2d').getImageData(0, 0, layer.originalCanvas.width, layer.originalCanvas.height) : 
                null
        })),
        currentLayerIndex: currentLayerIndex
    };
    
    historyStack.push(state);
    
    // 限制历史记录数量
    if (historyStack.length > MAX_HISTORY) {
        historyStack.shift();
    } else {
        historyIndex++;
    }
    
    console.log('[hosepen] 历史已保存，新索引:', historyIndex, '新栈长度:', historyStack.length);
    updateUndoRedoButtons();
}

function undo() {
    console.log('[hosepen] 撤销，当前索引:', historyIndex, '栈长度:', historyStack.length);
    if (historyIndex > 0) {
        historyIndex--;
        console.log('[hosepen] 恢复到索引:', historyIndex);
        restoreHistory(historyStack[historyIndex]);
        updateUndoRedoButtons();
        showNotification('↶ 已撤销', 'info');
    } else {
        console.log('[hosepen] 无法撤销，已经在最初状态');
        showNotification('⚠️ 无法撤销', 'info');
    }
}

function redo() {
    if (historyIndex < historyStack.length - 1) {
        historyIndex++;
        restoreHistory(historyStack[historyIndex]);
        updateUndoRedoButtons();
        showNotification('↷ 已重做', 'info');
    }
}

function restoreHistory(state) {
    // 恢复图层状态
    layers = state.layers.map(layerData => {
        const layerCanvas = document.createElement('canvas');
        layerCanvas.width = canvas.width;
        layerCanvas.height = canvas.height;
        const layerCtx = layerCanvas.getContext('2d');
        
        // 恢复图层内容
        layerCtx.putImageData(layerData.imageData, 0, 0);
        
        // 设置抗锯齿属性
        layerCtx.lineCap = 'round';
        layerCtx.lineJoin = 'round';
        
        // 恢复原始内容
        let originalCanvas = null;
        if (layerData.originalImageData) {
            originalCanvas = document.createElement('canvas');
            originalCanvas.width = canvas.width;
            originalCanvas.height = canvas.height;
            const originalCtx = originalCanvas.getContext('2d');
            originalCtx.putImageData(layerData.originalImageData, 0, 0);
        }
        
        return {
            id: layerData.id,
            name: layerData.name,
            canvas: layerCanvas,
            ctx: layerCtx,
            visible: layerData.visible,
            opacity: layerData.opacity,
            scaleX: layerData.scaleX,
            scaleY: layerData.scaleY,
            rotation: layerData.rotation,
            flipH: layerData.flipH,
            flipV: layerData.flipV,
            offsetX: layerData.offsetX,
            offsetY: layerData.offsetY,
            contentBounds: null,
            originalCanvas: originalCanvas
        };
    });
    
    currentLayerIndex = state.currentLayerIndex;
    
    // 更新UI
    renderLayerList();
    mergeAndRender();
}

function updateUndoRedoButtons() {
    const undoBtn = document.getElementById('undo-btn');
    const redoBtn = document.getElementById('redo-btn');
    
    if (undoBtn) {
        undoBtn.disabled = historyIndex <= 0;
        undoBtn.style.opacity = historyIndex <= 0 ? '0.5' : '1';
        undoBtn.style.cursor = historyIndex <= 0 ? 'not-allowed' : 'pointer';
    }
    
    if (redoBtn) {
        redoBtn.disabled = historyIndex >= historyStack.length - 1;
        redoBtn.style.opacity = historyIndex >= historyStack.length - 1 ? '0.5' : '1';
        redoBtn.style.cursor = historyIndex >= historyStack.length - 1 ? 'not-allowed' : 'pointer';
    }
}

// 添加键盘快捷键支持
document.addEventListener('keydown', (e) => {
    // 只有当画板窗口存在、可见且处于激活状态时才处理快捷键
    if (!drawingWindow || !drawingWindow.parentNode || drawingWindow.style.display === 'none') {
        return;
    }
    
    // 检查画板窗口是否在焦点内（鼠标是否在窗口上方）
    const rect = drawingWindow.getBoundingClientRect();
    const isMouseInWindow = (
        lastMouseX >= rect.left && lastMouseX <= rect.right &&
        lastMouseY >= rect.top && lastMouseY <= rect.bottom
    );
    
    // 如果鼠标不在窗口内，不处理快捷键（避免与录屏软件等冲突）
    if (!isMouseInWindow) {
        return;
    }
    
    // 检查是否在输入框中，如果是则不处理快捷键
    const activeElement = document.activeElement;
    if (activeElement && (
        activeElement.tagName === 'INPUT' || 
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.isContentEditable
    )) {
        return;
    }
    
    // 空格键 - 平移模式（可选：改为 H 键以避免与 OBS 冲突）
    // 使用空格键：e.code === 'Space'
    // 使用 H 键：e.key.toLowerCase() === 'h'
    if (e.code === 'Space' && !isSpacePressed && canvas) {
        e.preventDefault();
        e.stopPropagation();
        isSpacePressed = true;
        if (!isPanning && !isDrawing) {
            canvas.style.cursor = 'grab';
        }
        return;
    }
    
    // ESC 键关闭窗口
    if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        if (drawingWindow.parentNode) {
            drawingWindow.parentNode.removeChild(drawingWindow);
            drawingWindow = null;
        }
        return;
    }
    
    // 工具快捷键（不需要 Ctrl）
    if (!e.ctrlKey && !e.altKey && !e.metaKey) {
        switch(e.key.toLowerCase()) {
            case 'v':
                e.preventDefault();
                e.stopPropagation();
                toggleTransformMode('move');
                showNotification('🔄 移动模式', 'info');
                return;
            case 't':
                e.preventDefault();
                e.stopPropagation();
                toggleTransformMode('scale');
                showNotification('📏 缩放模式', 'info');
                return;
            case 'r':
                e.preventDefault();
                e.stopPropagation();
                toggleTransformMode('rotate');
                showNotification('🔄 旋转模式', 'info');
                return;
            case 'b':
                e.preventDefault();
                e.stopPropagation();
                isEraser = false;
                transformMode = null;
                // 清除所有变换状态
                isDraggingTransform = false;
                draggedHandle = null;
                isDraggingContent = false;
                canvas.style.cursor = 'crosshair';
                mergeAndRender();
                showNotification('🖌️ 画笔模式', 'info');
                return;
            case 'e':
                e.preventDefault();
                e.stopPropagation();
                isEraser = true;
                transformMode = null;
                // 清除所有变换状态
                isDraggingTransform = false;
                draggedHandle = null;
                isDraggingContent = false;
                canvas.style.cursor = 'crosshair';
                mergeAndRender();
                showNotification('🧹 橡皮擦模式', 'info');
                return;
        }
    }
    
    // Ctrl+V 粘贴图像
    if (e.ctrlKey && e.key === 'v') {
        e.preventDefault();
        e.stopPropagation();
        pasteImageFromClipboard();
        return;
    }
    
    // Ctrl+C 复制图像
    if (e.ctrlKey && e.key === 'c') {
        e.preventDefault();
        e.stopPropagation();
        copyImageToClipboard();
        return;
    }
    
    if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        undo();
        return;
    } else if (e.ctrlKey && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        e.stopPropagation();
        redo();
        return;
    } else if (e.ctrlKey && e.key === '0') {
        // Ctrl+0 重置视图
        e.preventDefault();
        e.stopPropagation();
        resetView();
        return;
    }
});

document.addEventListener('keyup', (e) => {
    // 只有当画板窗口存在、可见时才处理
    if (!drawingWindow || !drawingWindow.parentNode || drawingWindow.style.display === 'none') {
        return;
    }
    
    // 检查鼠标是否在窗口内
    const rect = drawingWindow.getBoundingClientRect();
    const isMouseInWindow = (
        lastMouseX >= rect.left && lastMouseX <= rect.right &&
        lastMouseY >= rect.top && lastMouseY <= rect.bottom
    );
    
    if (!isMouseInWindow) {
        return;
    }
    
    // 释放空格键
    if (e.code === 'Space' && isSpacePressed) {
        e.preventDefault();
        e.stopPropagation();
        isSpacePressed = false;
        if (canvas && !isPanning) {
            canvas.style.cursor = transformMode ? (transformMode === 'scale' ? 'crosshair' : 'grab') : 'crosshair';
        }
    }
});

// 导入图片功能
function importImage(e) {
    // 阻止事件冒泡
    if (e) {
        e.stopPropagation();
        e.preventDefault();
    }
    
    // 移除当前焦点，避免浏览器阻止文件对话框
    if (document.activeElement) {
        document.activeElement.blur();
    }
    
    const fileInput = document.getElementById('hosepen-file-input');
    if (fileInput) {
        // 使用 setTimeout 确保焦点已经移除
        setTimeout(() => {
            fileInput.click();
        }, 10);
    }
}

function handleImageImport(e) {
    // 阻止事件冒泡，防止被 ComfyUI 拦截
    e.stopPropagation();
    e.preventDefault();
    
    const file = e.target.files[0];
    if (!file) return;
    
    console.log('[hosepen] 开始导入图片:', file.name);
    
    // 检查是否是图片文件
    if (!file.type.startsWith('image/')) {
        showNotification('❌ 请选择图片文件', 'error');
        return;
    }
    
    // 如果没有图层，先创建一个
    if (layers.length === 0) {
        console.log('[hosepen] 没有图层，创建新图层');
        addLayer();
    }
    
    const reader = new FileReader();
    reader.onload = function(event) {
        console.log('[hosepen] 文件读取完成');
        const img = new Image();
        img.onload = function() {
            console.log('[hosepen] 图片加载完成:', img.width, 'x', img.height);
            
            // 创建新图层
            const layerCanvas = document.createElement('canvas');
            layerCanvas.width = canvas.width;
            layerCanvas.height = canvas.height;
            const layerCtx = layerCanvas.getContext('2d');
            
            // 设置抗锯齿
            layerCtx.imageSmoothingEnabled = true;
            layerCtx.imageSmoothingQuality = 'high';
            layerCtx.lineCap = 'round';
            layerCtx.lineJoin = 'round';
            
            // 计算缩放比例以适应画布
            const scale = Math.min(
                canvas.width / img.width,
                canvas.height / img.height,
                1 // 不放大，只缩小
            );
            
            const scaledWidth = img.width * scale;
            const scaledHeight = img.height * scale;
            const x = (canvas.width - scaledWidth) / 2;
            const y = (canvas.height - scaledHeight) / 2;
            
            console.log('[hosepen] 绘制参数:', {
                scale: scale.toFixed(2),
                size: `${scaledWidth.toFixed(0)}x${scaledHeight.toFixed(0)}`,
                position: `(${x.toFixed(0)},${y.toFixed(0)})`
            });
            
            // 绘制图片到新图层
            layerCtx.drawImage(img, x, y, scaledWidth, scaledHeight);
            
            // 创建图层对象
            const newLayer = {
                id: Date.now(),
                name: `图片 ${layers.length + 1}`,
                canvas: layerCanvas,
                ctx: layerCtx,
                visible: true,
                opacity: 1,
                blendMode: 'normal',
                scale: 1,
                scaleX: 1,
                scaleY: 1,
                rotation: 0,
                flipH: false,
                flipV: false,
                offsetX: 0,
                offsetY: 0,
                contentBounds: null,
                originalCanvas: null
            };
            
            // 创建原始画布备份
            newLayer.originalCanvas = document.createElement('canvas');
            newLayer.originalCanvas.width = newLayer.canvas.width;
            newLayer.originalCanvas.height = newLayer.canvas.height;
            const originalCtx = newLayer.originalCanvas.getContext('2d');
            originalCtx.drawImage(newLayer.canvas, 0, 0);
            
            // 添加到图层列表
            layers.push(newLayer);
            currentLayerIndex = layers.length - 1;
            
            console.log('[hosepen] 已创建新图层:', newLayer.name);
            
            // 保存历史记录
            saveHistory();
            
            // 更新UI
            renderLayerList();
            mergeAndRender();
            
            showNotification(`✅ 已导入图片: ${file.name}`, 'success');
        };
        
        img.onerror = function() {
            console.error('[hosepen] 图片加载失败');
            showNotification('❌ 图片加载失败', 'error');
        };
        
        img.src = event.target.result;
    };
    
    reader.onerror = function() {
        console.error('[hosepen] 文件读取失败');
        showNotification('❌ 文件读取失败', 'error');
    };
    
    reader.readAsDataURL(file);
    
    // 清空文件输入，允许重复导入同一文件
    e.target.value = '';
}

// 从节点导入图像
async function importFromNode() {
    console.log('[hosepen] 开始从节点导入图像');
    
    try {
        // 获取 ComfyUI 的 API
        const app = window.app;
        if (!app) {
            showNotification('❌ 无法访问 ComfyUI API', 'error');
            return;
        }
        
        // 查找所有 HosepenImageInput 节点
        const graph = app.graph;
        if (!graph) {
            showNotification('❌ 无法访问工作流图', 'error');
            return;
        }
        
        const imageInputNodes = graph._nodes.filter(node => 
            node.type === 'HosepenImageInput'
        );
        
        if (imageInputNodes.length === 0) {
            showNotification('❌ 工作流中没有 "Hosepen Image Input" 节点', 'error');
            return;
        }
        
        console.log('[hosepen] 找到', imageInputNodes.length, '个图像输入节点');
        
        // 如果有多个节点，使用第一个
        const node = imageInputNodes[0];
        const nodeId = node.id;
        
        // 查找连接到这个节点的源节点
        let sourceNodeId = null;
        if (node.inputs && node.inputs.length > 0) {
            const input = node.inputs[0];
            if (input.link != null) {
                const link = graph.links[input.link];
                if (link) {
                    sourceNodeId = link.origin_id;
                    console.log('[hosepen] 找到源节点:', sourceNodeId);
                }
            }
        }
        
        if (!sourceNodeId) {
            showNotification('❌ 节点没有连接图像输入，请连接一个图像节点', 'error');
            return;
        }
        
        showNotification('⏳ 正在执行工作流...', 'info');
        
        // 自动执行工作流
        try {
            // 获取当前工作流
            const prompt = await app.graphToPrompt();
            
            console.log('[hosepen] 准备执行工作流');
            
            // 直接调用 API 执行
            const response = await fetch('/prompt', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    prompt: prompt.output,
                    client_id: app.clientId
                })
            });
            
            if (!response.ok) {
                throw new Error('执行工作流失败: ' + response.statusText);
            }
            
            const result = await response.json();
            console.log('[hosepen] 工作流已加入队列, prompt_id:', result.prompt_id);
            showNotification('⏳ 等待工作流执行完成...', 'info');
            
            // 等待执行完成并获取结果，传入源节点ID和prompt_id
            waitForNodeOutput(sourceNodeId, result.prompt_id);
            
        } catch (execError) {
            console.error('[hosepen] 执行工作流失败:', execError);
            showNotification('❌ 执行工作流失败: ' + execError.message, 'error');
        }
        
    } catch (error) {
        console.error('[hosepen] 从节点导入失败:', error);
        showNotification('❌ 导入失败: ' + error.message, 'error');
    }
}

// 等待节点输出并导入图像
function waitForNodeOutput(nodeId, promptId) {
    console.log('[hosepen] 等待节点输出:', nodeId, 'prompt_id:', promptId);
    
    // 监听执行完成事件
    const app = window.app;
    let checkCount = 0;
    const maxChecks = 60; // 最多等待60秒
    
    const checkInterval = setInterval(async () => {
        checkCount++;
        
        try {
            // 查询所有历史记录
            const response = await fetch('/history');
            const history = await response.json();
            
            // 检查是否有这个 prompt 的历史记录
            if (!history || !history[promptId]) {
                // 如果还没有记录，继续等待
                if (checkCount >= maxChecks) {
                    clearInterval(checkInterval);
                    showNotification('❌ 执行超时', 'error');
                }
                return;
            }
            
            const item = history[promptId];
            
            // 检查是否完成
            if (item.status && item.status.completed) {
                clearInterval(checkInterval);
                
                console.log('[hosepen] 工作流执行完成，查找图像输出');
                console.log('[hosepen] 输出数据:', item.outputs);
                
                // 查找任何图像输出
                let foundImage = false;
                
                if (item.outputs) {
                    console.log('[hosepen] 所有输出节点:', Object.keys(item.outputs));
                    
                    // 遍历所有节点的输出，查找图像
                    for (const [outputNodeId, output] of Object.entries(item.outputs)) {
                        console.log('[hosepen] 检查节点', outputNodeId, '的输出:', JSON.stringify(output, null, 2));
                        
                        // 检查标准的 images 字段
                        if (output.images && output.images.length > 0) {
                            const imageInfo = output.images[0];
                            const imageUrl = `/view?filename=${imageInfo.filename}&subfolder=${imageInfo.subfolder || ''}&type=${imageInfo.type || 'output'}`;
                            console.log('[hosepen] 从节点', outputNodeId, '获取到图像:', imageUrl);
                            loadImageFromUrl(imageUrl);
                            foundImage = true;
                            break;
                        }
                        
                        // 检查其他可能的图像字段（如 ui.images）
                        if (output.ui && output.ui.images && output.ui.images.length > 0) {
                            const imageInfo = output.ui.images[0];
                            const imageUrl = `/view?filename=${imageInfo.filename}&subfolder=${imageInfo.subfolder || ''}&type=${imageInfo.type || 'output'}`;
                            console.log('[hosepen] 从节点', outputNodeId, '的 ui.images 获取到图像:', imageUrl);
                            loadImageFromUrl(imageUrl);
                            foundImage = true;
                            break;
                        }
                    }
                } else {
                    console.error('[hosepen] outputs 为空或不存在');
                }
                
                if (!foundImage) {
                    console.error('[hosepen] 未找到任何图像输出');
                    console.error('[hosepen] 完整的历史记录:', JSON.stringify(item, null, 2));
                    showNotification('❌ 未找到图像输出，请在工作流中添加 SaveImage 或 PreviewImage 节点', 'error');
                }
                return;
            }
            
            // 检查是否有错误
            if (item.status && item.status.status_str === 'error') {
                clearInterval(checkInterval);
                showNotification('❌ 工作流执行出错', 'error');
                return;
            }
            
        } catch (error) {
            console.error('[hosepen] 检查执行状态失败:', error);
        }
        
        // 超时检查
        if (checkCount >= maxChecks) {
            clearInterval(checkInterval);
            showNotification('❌ 等待执行超时，请检查工作流', 'error');
        }
    }, 1000); // 每秒检查一次
}

// 从 URL 加载图像并添加到画板
function loadImageFromUrl(url) {
    console.log('[hosepen] 从 URL 加载图像:', url);
    
    const img = new Image();
    img.crossOrigin = 'anonymous'; // 允许跨域
    
    img.onload = function() {
        console.log('[hosepen] 图片加载完成:', img.width, 'x', img.height);
        
        // 创建新图层
        const layerCanvas = document.createElement('canvas');
        layerCanvas.width = canvas.width;
        layerCanvas.height = canvas.height;
        const layerCtx = layerCanvas.getContext('2d');
        
        // 设置抗锯齿
        layerCtx.imageSmoothingEnabled = true;
        layerCtx.imageSmoothingQuality = 'high';
        layerCtx.lineCap = 'round';
        layerCtx.lineJoin = 'round';
        
        // 计算缩放比例以适应画布
        const scale = Math.min(
            canvas.width / img.width,
            canvas.height / img.height,
            1 // 不放大，只缩小
        );
        
        const scaledWidth = img.width * scale;
        const scaledHeight = img.height * scale;
        const x = (canvas.width - scaledWidth) / 2;
        const y = (canvas.height - scaledHeight) / 2;
        
        // 绘制图片到新图层
        layerCtx.drawImage(img, x, y, scaledWidth, scaledHeight);
        
        // 创建图层对象
        const newLayer = {
            id: Date.now(),
            name: `节点图片 ${layers.length + 1}`,
            canvas: layerCanvas,
            ctx: layerCtx,
            visible: true,
            opacity: 1,
            blendMode: 'normal',
            scale: 1,
            scaleX: 1,
            scaleY: 1,
            rotation: 0,
            flipH: false,
            flipV: false,
            offsetX: 0,
            offsetY: 0,
            contentBounds: null,
            originalCanvas: null
        };
        
        // 创建原始画布备份
        newLayer.originalCanvas = document.createElement('canvas');
        newLayer.originalCanvas.width = newLayer.canvas.width;
        newLayer.originalCanvas.height = newLayer.canvas.height;
        const originalCtx = newLayer.originalCanvas.getContext('2d');
        originalCtx.drawImage(newLayer.canvas, 0, 0);
        
        // 添加到图层列表
        layers.push(newLayer);
        currentLayerIndex = layers.length - 1;
        
        console.log('[hosepen] 已创建新图层:', newLayer.name);
        
        // 保存历史记录
        saveHistory();
        
        // 更新UI
        renderLayerList();
        mergeAndRender();
        
        showNotification(`✅ 已从节点导入图像`, 'success');
    };
    
    img.onerror = function() {
        console.error('[hosepen] 图片加载失败');
        showNotification('❌ 图片加载失败', 'error');
    };
    
    img.src = url;
}

// 从剪贴板粘贴图像（Ctrl+V）
async function pasteImageFromClipboard() {
    console.log('[hosepen] 尝试从剪贴板粘贴图像');
    
    try {
        // 检查剪贴板 API 是否可用
        if (!navigator.clipboard || !navigator.clipboard.read) {
            showNotification('❌ 浏览器不支持剪贴板 API', 'error');
            console.error('[hosepen] 剪贴板 API 不可用');
            return;
        }
        
        showNotification('⏳ 正在读取剪贴板...', 'info');
        
        // 读取剪贴板内容
        const clipboardItems = await navigator.clipboard.read();
        
        for (const clipboardItem of clipboardItems) {
            // 查找图像类型
            for (const type of clipboardItem.types) {
                if (type.startsWith('image/')) {
                    console.log('[hosepen] 找到图像类型:', type);
                    
                    const blob = await clipboardItem.getType(type);
                    const url = URL.createObjectURL(blob);
                    
                    // 使用现有的图像加载函数
                    const img = new Image();
                    
                    img.onload = function() {
                        console.log('[hosepen] 剪贴板图片加载完成:', img.width, 'x', img.height);
                        
                        // 创建新图层
                        const layerCanvas = document.createElement('canvas');
                        layerCanvas.width = canvas.width;
                        layerCanvas.height = canvas.height;
                        const layerCtx = layerCanvas.getContext('2d');
                        
                        // 设置抗锯齿
                        layerCtx.imageSmoothingEnabled = true;
                        layerCtx.imageSmoothingQuality = 'high';
                        layerCtx.lineCap = 'round';
                        layerCtx.lineJoin = 'round';
                        
                        // 计算缩放比例以适应画布
                        const scale = Math.min(
                            canvas.width / img.width,
                            canvas.height / img.height,
                            1 // 不放大，只缩小
                        );
                        
                        const scaledWidth = img.width * scale;
                        const scaledHeight = img.height * scale;
                        const x = (canvas.width - scaledWidth) / 2;
                        const y = (canvas.height - scaledHeight) / 2;
                        
                        // 绘制图片到新图层
                        layerCtx.drawImage(img, x, y, scaledWidth, scaledHeight);
                        
                        // 创建图层对象
                        const newLayer = {
                            id: Date.now(),
                            name: `粘贴图片 ${layers.length + 1}`,
                            canvas: layerCanvas,
                            ctx: layerCtx,
                            visible: true,
                            opacity: 1,
                            blendMode: 'normal',
                            scale: 1,
                            scaleX: 1,
                            scaleY: 1,
                            rotation: 0,
                            flipH: false,
                            flipV: false,
                            offsetX: 0,
                            offsetY: 0,
                            contentBounds: null,
                            originalCanvas: null
                        };
                        
                        // 创建原始画布备份
                        newLayer.originalCanvas = document.createElement('canvas');
                        newLayer.originalCanvas.width = newLayer.canvas.width;
                        newLayer.originalCanvas.height = newLayer.canvas.height;
                        const originalCtx = newLayer.originalCanvas.getContext('2d');
                        originalCtx.drawImage(newLayer.canvas, 0, 0);
                        
                        // 添加到图层列表
                        layers.push(newLayer);
                        currentLayerIndex = layers.length - 1;
                        
                        console.log('[hosepen] 已创建新图层:', newLayer.name);
                        
                        // 保存历史记录
                        saveHistory();
                        
                        // 更新UI
                        renderLayerList();
                        mergeAndRender();
                        
                        showNotification(`✅ 已从剪贴板粘贴图像 (${img.width}×${img.height})`, 'success');
                        
                        // 释放临时 URL
                        URL.revokeObjectURL(url);
                    };
                    
                    img.onerror = function() {
                        console.error('[hosepen] 剪贴板图片加载失败');
                        showNotification('❌ 图片加载失败', 'error');
                        URL.revokeObjectURL(url);
                    };
                    
                    img.src = url;
                    return;
                }
            }
        }
        
        // 如果没有找到图像
        showNotification('❌ 剪贴板中没有图像', 'error');
        console.log('[hosepen] 剪贴板中没有图像数据');
        
    } catch (error) {
        console.error('[hosepen] 粘贴失败:', error);
        if (error.name === 'NotAllowedError') {
            showNotification('❌ 需要授权访问剪贴板，请允许权限', 'error');
        } else {
            showNotification('❌ 粘贴失败: ' + error.message, 'error');
        }
    }
}

// 复制图像到剪贴板（Ctrl+C）
async function copyImageToClipboard() {
    console.log('[hosepen] 尝试复制图像到剪贴板');
    
    try {
        // 检查剪贴板 API 是否可用
        if (!navigator.clipboard || !navigator.clipboard.write) {
            showNotification('❌ 浏览器不支持剪贴板 API', 'error');
            console.error('[hosepen] 剪贴板 API 不可用');
            return;
        }
        
        showNotification('⏳ 正在复制到剪贴板...', 'info');
        
        // 创建临时画布来合并所有图层
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        
        // 绘制背景色
        tempCtx.fillStyle = backgroundColor;
        tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
        
        // 合并所有可见图层
        layers.forEach(layer => {
            if (layer.visible) {
                tempCtx.save();
                tempCtx.globalAlpha = layer.opacity;
                tempCtx.globalCompositeOperation = layer.blendMode || 'source-over';
                
                // 应用变换
                const centerX = tempCanvas.width / 2;
                const centerY = tempCanvas.height / 2;
                
                tempCtx.translate(centerX + layer.offsetX, centerY + layer.offsetY);
                tempCtx.rotate((layer.rotation || 0) * Math.PI / 180);
                tempCtx.scale(
                    (layer.scaleX || 1) * (layer.flipH ? -1 : 1),
                    (layer.scaleY || 1) * (layer.flipV ? -1 : 1)
                );
                tempCtx.translate(-centerX, -centerY);
                
                tempCtx.drawImage(layer.canvas, 0, 0);
                tempCtx.restore();
            }
        });
        
        // 转换为 Blob
        const blob = await new Promise(resolve => {
            tempCanvas.toBlob(resolve, 'image/png');
        });
        
        if (!blob) {
            throw new Error('无法创建图像数据');
        }
        
        // 写入剪贴板
        await navigator.clipboard.write([
            new ClipboardItem({
                'image/png': blob
            })
        ]);
        
        console.log('[hosepen] 图像已复制到剪贴板');
        showNotification(`✅ 已复制到剪贴板 (${canvas.width}×${canvas.height})`, 'success');
        
    } catch (error) {
        console.error('[hosepen] 复制失败:', error);
        if (error.name === 'NotAllowedError') {
            showNotification('❌ 需要授权访问剪贴板，请允许权限', 'error');
        } else {
            showNotification('❌ 复制失败: ' + error.message, 'error');
        }
    }
}

// 导出图像到节点
async function exportToNode() {
    console.log('[hosepen] 开始导出图像到节点');
    
    try {
        // 获取 ComfyUI 的 API
        const app = window.app;
        if (!app) {
            showNotification('❌ 无法访问 ComfyUI API', 'error');
            return;
        }
        
        // 查找所有 HosepenImageOutput 节点
        const graph = app.graph;
        if (!graph) {
            showNotification('❌ 无法访问工作流图', 'error');
            return;
        }
        
        const imageOutputNodes = graph._nodes.filter(node => 
            node.type === 'HosepenImageOutput'
        );
        
        if (imageOutputNodes.length === 0) {
            showNotification('❌ 工作流中没有 "Hosepen Image Output" 节点', 'error');
            return;
        }
        
        console.log('[hosepen] 找到', imageOutputNodes.length, '个图像输出节点');
        
        showNotification('⏳ 正在导出图像...', 'info');
        
        // 创建一个临时画布来合并所有图层
        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = canvas.width;
        exportCanvas.height = canvas.height;
        const exportCtx = exportCanvas.getContext('2d');
        
        // 填充白色背景
        exportCtx.fillStyle = '#FFFFFF';
        exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
        
        // 合并所有可见图层
        for (let i = 0; i < layers.length; i++) {
            const layer = layers[i];
            if (!layer.visible) continue;
            
            exportCtx.save();
            exportCtx.globalAlpha = layer.opacity;
            
            // 应用图层变换
            exportCtx.translate(exportCanvas.width / 2, exportCanvas.height / 2);
            exportCtx.translate(layer.offsetX, layer.offsetY);
            exportCtx.rotate(layer.rotation);
            exportCtx.scale(layer.scaleX * (layer.flipH ? -1 : 1), layer.scaleY * (layer.flipV ? -1 : 1));
            exportCtx.translate(-exportCanvas.width / 2, -exportCanvas.height / 2);
            
            // 绘制图层内容
            exportCtx.drawImage(layer.canvas, 0, 0);
            
            exportCtx.restore();
        }
        
        console.log('[hosepen] 已合并', layers.length, '个图层');
        
        // 获取导出画布的图像
        const imageDataUrl = exportCanvas.toDataURL('image/png');
        
        // 将 base64 转换为 blob
        const response = await fetch(imageDataUrl);
        const blob = await response.blob();
        
        // 创建 FormData 上传图像
        const formData = new FormData();
        formData.append('image', blob, 'hosepen_export.png');
        formData.append('subfolder', 'hosepen');
        formData.append('type', 'input');
        
        // 上传图像到 ComfyUI
        const uploadResponse = await fetch('/upload/image', {
            method: 'POST',
            body: formData
        });
        
        if (!uploadResponse.ok) {
            throw new Error('上传图像失败: ' + uploadResponse.statusText);
        }
        
        const uploadResult = await uploadResponse.json();
        console.log('[hosepen] 图像已上传:', uploadResult);
        
        // 更新节点的图像引用
        const node = imageOutputNodes[0];
        
        // 查找或创建图像 widget
        let imageWidget = node.widgets?.find(w => w.name === 'image');
        
        if (imageWidget) {
            // 更新现有 widget 的值
            imageWidget.value = uploadResult.name;
            console.log('[hosepen] 已更新 widget 值:', uploadResult.name);
        } else {
            console.log('[hosepen] 节点没有 image widget，可能需要重新加载节点');
        }
        
        // 标记节点需要重新执行
        node.setDirtyCanvas(true, true);
        
        console.log('[hosepen] 节点已更新图像数据');
        showNotification('✅ 图像已导出到节点，请重新执行工作流查看结果', 'success');
        
        // 标记图形需要重绘
        graph.setDirtyCanvas(true, true);
        
    } catch (error) {
        console.error('[hosepen] 导出失败:', error);
        showNotification('❌ 导出失败: ' + error.message, 'error');
    }
}

// 显示画板尺寸设置对话框
function showCanvasSizeDialog() {
    // 创建对话框遮罩
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10001;
    `;
    
    // 创建对话框
    const dialog = document.createElement('div');
    dialog.style.cssText = `
        background: white;
        border-radius: 12px;
        padding: 30px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        min-width: 400px;
    `;
    
    // 标题
    const title = document.createElement('h3');
    title.textContent = '设置画板尺寸';
    title.style.cssText = `
        margin: 0 0 20px 0;
        font-size: 18px;
        color: #333;
    `;
    
    // 当前尺寸提示
    const currentSize = document.createElement('p');
    currentSize.textContent = `当前尺寸: ${canvas.width} × ${canvas.height}`;
    currentSize.style.cssText = `
        margin: 0 0 20px 0;
        color: #666;
        font-size: 14px;
    `;
    
    // 宽度输入
    const widthLabel = document.createElement('label');
    widthLabel.textContent = '宽度:';
    widthLabel.style.cssText = `
        display: block;
        margin-bottom: 5px;
        font-size: 14px;
        color: #333;
    `;
    
    const widthInput = document.createElement('input');
    widthInput.type = 'number';
    widthInput.value = canvas.width;
    widthInput.min = '256';
    widthInput.max = '4096';
    widthInput.step = '64';
    widthInput.style.cssText = `
        width: 100%;
        padding: 8px;
        border: 1px solid #ddd;
        border-radius: 6px;
        font-size: 14px;
        margin-bottom: 15px;
        box-sizing: border-box;
    `;
    
    // 高度输入
    const heightLabel = document.createElement('label');
    heightLabel.textContent = '高度:';
    heightLabel.style.cssText = `
        display: block;
        margin-bottom: 5px;
        font-size: 14px;
        color: #333;
    `;
    
    const heightInput = document.createElement('input');
    heightInput.type = 'number';
    heightInput.value = canvas.height;
    heightInput.min = '256';
    heightInput.max = '4096';
    heightInput.step = '64';
    heightInput.style.cssText = `
        width: 100%;
        padding: 8px;
        border: 1px solid #ddd;
        border-radius: 6px;
        font-size: 14px;
        margin-bottom: 15px;
        box-sizing: border-box;
    `;
    
    // 常用尺寸快捷按钮
    const presetsLabel = document.createElement('p');
    presetsLabel.textContent = '常用尺寸:';
    presetsLabel.style.cssText = `
        margin: 15px 0 10px 0;
        font-size: 14px;
        color: #333;
    `;
    
    const presetsContainer = document.createElement('div');
    presetsContainer.style.cssText = `
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
        margin-bottom: 20px;
    `;
    
    const presets = [
        { name: '512×512', width: 512, height: 512 },
        { name: '768×768', width: 768, height: 768 },
        { name: '1024×1024', width: 1024, height: 1024 },
        { name: '512×768', width: 512, height: 768 },
        { name: '768×512', width: 768, height: 512 },
        { name: '1024×768', width: 1024, height: 768 },
    ];
    
    presets.forEach(preset => {
        const btn = document.createElement('button');
        btn.textContent = preset.name;
        btn.style.cssText = `
            padding: 6px 12px;
            background: #f0f0f0;
            border: 1px solid #ddd;
            border-radius: 6px;
            cursor: pointer;
            font-size: 12px;
            transition: background 0.2s;
        `;
        btn.addEventListener('mouseenter', () => btn.style.background = '#e0e0e0');
        btn.addEventListener('mouseleave', () => btn.style.background = '#f0f0f0');
        btn.addEventListener('click', () => {
            widthInput.value = preset.width;
            heightInput.value = preset.height;
        });
        presetsContainer.appendChild(btn);
    });
    
    // 按钮容器
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
        display: flex;
        gap: 10px;
        justify-content: flex-end;
        margin-top: 20px;
    `;
    
    // 取消按钮
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = '取消';
    cancelBtn.style.cssText = `
        padding: 10px 20px;
        background: #9E9E9E;
        border: none;
        border-radius: 6px;
        color: white;
        cursor: pointer;
        font-size: 14px;
        transition: background 0.2s;
    `;
    cancelBtn.addEventListener('mouseenter', () => cancelBtn.style.background = '#757575');
    cancelBtn.addEventListener('mouseleave', () => cancelBtn.style.background = '#9E9E9E');
    cancelBtn.addEventListener('click', () => {
        document.body.removeChild(overlay);
    });
    
    // 确认按钮
    const confirmBtn = document.createElement('button');
    confirmBtn.textContent = '确认';
    confirmBtn.style.cssText = `
        padding: 10px 20px;
        background: #4CAF50;
        border: none;
        border-radius: 6px;
        color: white;
        cursor: pointer;
        font-size: 14px;
        transition: background 0.2s;
    `;
    confirmBtn.addEventListener('mouseenter', () => confirmBtn.style.background = '#45a049');
    confirmBtn.addEventListener('mouseleave', () => confirmBtn.style.background = '#4CAF50');
    confirmBtn.addEventListener('click', () => {
        const newWidth = parseInt(widthInput.value);
        const newHeight = parseInt(heightInput.value);
        
        if (newWidth < 256 || newWidth > 4096 || newHeight < 256 || newHeight > 4096) {
            showNotification('❌ 尺寸必须在 256-4096 之间', 'error');
            return;
        }
        
        resizeCanvas(newWidth, newHeight);
        document.body.removeChild(overlay);
    });
    
    // 组装对话框
    dialog.appendChild(title);
    dialog.appendChild(currentSize);
    dialog.appendChild(widthLabel);
    dialog.appendChild(widthInput);
    dialog.appendChild(heightLabel);
    dialog.appendChild(heightInput);
    dialog.appendChild(presetsLabel);
    dialog.appendChild(presetsContainer);
    buttonContainer.appendChild(cancelBtn);
    buttonContainer.appendChild(confirmBtn);
    dialog.appendChild(buttonContainer);
    
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    
    // 点击遮罩关闭
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            document.body.removeChild(overlay);
        }
    });
}

// 调整画板尺寸
function resizeCanvas(newWidth, newHeight) {
    console.log('[hosepen] 调整画板尺寸:', newWidth, 'x', newHeight);
    
    const oldWidth = canvas.width;
    const oldHeight = canvas.height;
    
    // 调整主画布
    canvas.width = newWidth;
    canvas.height = newHeight;
    
    // 重新初始化画布上下文设置
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    // 重置视图变换（重要！）
    viewScale = 1;
    viewOffsetX = 0;
    viewOffsetY = 0;
    isPanning = false;
    isSpacePressed = false;
    
    // 退出变换模式（重要！）
    transformMode = null;
    isDraggingTransform = false;
    draggedHandle = null;
    isDraggingContent = false;
    
    // 更新变换按钮状态
    updateTransformButtonStates();
    
    // 调整所有图层画布
    layers.forEach(layer => {
        // 保存旧的图层内容
        const oldCanvas = layer.canvas;
        
        // 创建新的图层画布
        const newCanvas = document.createElement('canvas');
        newCanvas.width = newWidth;
        newCanvas.height = newHeight;
        const newCtx = newCanvas.getContext('2d');
        
        // 设置抗锯齿
        newCtx.imageSmoothingEnabled = true;
        newCtx.imageSmoothingQuality = 'high';
        newCtx.lineCap = 'round';
        newCtx.lineJoin = 'round';
        
        // 将旧内容绘制到新画布（居中）
        const offsetX = (newWidth - oldWidth) / 2;
        const offsetY = (newHeight - oldHeight) / 2;
        newCtx.drawImage(oldCanvas, offsetX, offsetY);
        
        // 更新图层
        layer.canvas = newCanvas;
        layer.ctx = newCtx;
        layer.contentBounds = null; // 重新计算边界
        
        // 更新原始画布（如果有）
        if (layer.originalCanvas) {
            const newOriginal = document.createElement('canvas');
            newOriginal.width = newWidth;
            newOriginal.height = newHeight;
            const newOriginalCtx = newOriginal.getContext('2d');
            newOriginalCtx.drawImage(layer.originalCanvas, offsetX, offsetY);
            layer.originalCanvas = newOriginal;
        }
    });
    
    // 更新画布样式和光标
    canvas.style.cursor = 'crosshair';
    
    // 重要：清除可能的 CSS 尺寸设置，让画布使用实际像素尺寸
    // 这确保坐标计算正确
    canvas.style.width = '';
    canvas.style.height = '';
    
    // 更新缩放显示
    const zoomDisplay = document.getElementById('zoom-display');
    if (zoomDisplay) {
        zoomDisplay.textContent = '100%';
    }
    
    // 保存历史记录
    saveHistory();
    
    // 重新渲染
    mergeAndRender();
    
    showNotification(`✅ 画板尺寸已调整为 ${newWidth} × ${newHeight}`, 'success');
    console.log('[hosepen] 画板尺寸调整完成，视图已重置');
}

// 切换图层选择状态
function toggleLayerSelection(index, isMultiSelect) {
    if (isMultiSelect) {
        // 多选模式
        const idx = selectedLayerIndices.indexOf(index);
        if (idx > -1) {
            // 取消选中
            selectedLayerIndices.splice(idx, 1);
        } else {
            // 添加选中
            selectedLayerIndices.push(index);
        }
    } else {
        // 单选模式
        selectedLayerIndices = [index];
    }
    
    // 如果没有选中的图层，默认选中当前图层
    if (selectedLayerIndices.length === 0) {
        selectedLayerIndices = [currentLayerIndex];
    }
    
    console.log('[hosepen] 选中图层:', selectedLayerIndices);
    renderLayerList();
    mergeAndRender();
}

// 获取选中图层的数量
function getSelectedLayersCount() {
    return selectedLayerIndices.length;
}

// 对所有选中的图层应用变换
function applyTransformToSelectedLayers(transformFunc) {
    selectedLayerIndices.forEach(index => {
        if (index >= 0 && index < layers.length) {
            transformFunc(layers[index]);
        }
    });
}

// 文本输入对话框
function showTextInputDialog() {
    // 检查是否已存在对话框
    if (document.getElementById('text-input-dialog')) {
        return;
    }
    
    // 创建对话框背景
    const dialogOverlay = document.createElement('div');
    dialogOverlay.id = 'text-input-dialog';
    dialogOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10001;
    `;
    
    // 创建对话框内容
    const dialog = document.createElement('div');
    dialog.style.cssText = `
        background: white;
        border-radius: 12px;
        padding: 30px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
        max-width: 500px;
        width: 90%;
        max-height: 80vh;
        overflow-y: auto;
    `;
    
    // 对话框标题
    const title = document.createElement('h3');
    title.textContent = '📝 添加文本';
    title.style.cssText = `
        margin: 0 0 20px 0;
        color: #333;
        font-size: 20px;
        text-align: center;
    `;
    
    // 文本输入区域
    const textArea = document.createElement('textarea');
    textArea.placeholder = '请输入文本内容...';
    textArea.style.cssText = `
        width: 100%;
        height: 120px;
        padding: 12px;
        border: 2px solid #ddd;
        border-radius: 8px;
        font-size: 16px;
        font-family: inherit;
        resize: vertical;
        box-sizing: border-box;
        margin-bottom: 15px;
    `;
    textArea.focus();
    
    // 设置容器
    const settingsContainer = document.createElement('div');
    settingsContainer.style.cssText = `
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 15px;
        margin-bottom: 20px;
    `;
    
    // 字体大小设置
    const fontSizeContainer = document.createElement('div');
    const fontSizeLabel = document.createElement('label');
    fontSizeLabel.textContent = '字体大小:';
    fontSizeLabel.style.cssText = `
        display: block;
        margin-bottom: 5px;
        font-weight: 500;
        color: #333;
    `;
    
    const fontSizeInput = document.createElement('input');
    fontSizeInput.type = 'number';
    fontSizeInput.min = '10';
    fontSizeInput.max = '200';
    fontSizeInput.value = '32';
    fontSizeInput.style.cssText = `
        width: 100%;
        padding: 8px;
        border: 2px solid #ddd;
        border-radius: 6px;
        font-size: 14px;
        box-sizing: border-box;
    `;
    
    fontSizeContainer.appendChild(fontSizeLabel);
    fontSizeContainer.appendChild(fontSizeInput);
    
    // 文本颜色设置
    const colorContainer = document.createElement('div');
    const colorLabel = document.createElement('label');
    colorLabel.textContent = '文本颜色:';
    colorLabel.style.cssText = `
        display: block;
        margin-bottom: 5px;
        font-weight: 500;
        color: #333;
    `;
    
    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.value = currentColor;
    colorInput.style.cssText = `
        width: 100%;
        height: 40px;
        border: 2px solid #ddd;
        border-radius: 6px;
        cursor: pointer;
        box-sizing: border-box;
    `;
    
    colorContainer.appendChild(colorLabel);
    colorContainer.appendChild(colorInput);
    
    // 字体类型设置
    const fontFamilyContainer = document.createElement('div');
    fontFamilyContainer.style.cssText = `
        grid-column: 1 / -1;
    `;
    
    const fontFamilyLabel = document.createElement('label');
    fontFamilyLabel.textContent = '字体类型:';
    fontFamilyLabel.style.cssText = `
        display: block;
        margin-bottom: 5px;
        font-weight: 500;
        color: #333;
    `;
    
    const fontFamilySelect = document.createElement('select');
    fontFamilySelect.style.cssText = `
        width: 100%;
        padding: 8px;
        border: 2px solid #ddd;
        border-radius: 6px;
        font-size: 14px;
        box-sizing: border-box;
    `;
    
    const fontOptions = [
        { value: 'Arial', text: 'Arial' },
        { value: 'Microsoft YaHei', text: '微软雅黑' },
        { value: 'SimHei', text: '黑体' },
        { value: 'SimSun', text: '宋体' },
        { value: 'KaiTi', text: '楷体' },
        { value: 'Times New Roman', text: 'Times New Roman' },
        { value: 'Helvetica', text: 'Helvetica' },
        { value: 'Georgia', text: 'Georgia' }
    ];
    
    fontOptions.forEach(option => {
        const optionElement = document.createElement('option');
        optionElement.value = option.value;
        optionElement.textContent = option.text;
        fontFamilySelect.appendChild(optionElement);
    });
    
    fontFamilyContainer.appendChild(fontFamilyLabel);
    fontFamilyContainer.appendChild(fontFamilySelect);
    
    settingsContainer.appendChild(fontSizeContainer);
    settingsContainer.appendChild(colorContainer);
    settingsContainer.appendChild(fontFamilyContainer);
    
    // 按钮容器
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
        display: flex;
        gap: 10px;
        justify-content: flex-end;
    `;
    
    // 取消按钮
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = '取消';
    cancelBtn.style.cssText = `
        padding: 10px 20px;
        background: #6c757d;
        color: white;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
        transition: background 0.2s;
    `;
    cancelBtn.addEventListener('mouseenter', () => cancelBtn.style.background = '#5a6268');
    cancelBtn.addEventListener('mouseleave', () => cancelBtn.style.background = '#6c757d');
    
    // 确认按钮
    const confirmBtn = document.createElement('button');
    confirmBtn.textContent = '添加文本';
    confirmBtn.style.cssText = `
        padding: 10px 20px;
        background: #9C27B0;
        color: white;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
        transition: background 0.2s;
    `;
    confirmBtn.addEventListener('mouseenter', () => confirmBtn.style.background = '#7B1FA2');
    confirmBtn.addEventListener('mouseleave', () => confirmBtn.style.background = '#9C27B0');
    
    buttonContainer.appendChild(cancelBtn);
    buttonContainer.appendChild(confirmBtn);
    
    // 组装对话框
    dialog.appendChild(title);
    dialog.appendChild(textArea);
    dialog.appendChild(settingsContainer);
    dialog.appendChild(buttonContainer);
    dialogOverlay.appendChild(dialog);
    
    // 事件处理
    const closeDialog = () => {
        document.body.removeChild(dialogOverlay);
    };
    
    const addText = () => {
        const text = textArea.value.trim();
        if (!text) {
            showNotification('❌ 请输入文本内容', 'error');
            return;
        }
        
        const fontSize = parseInt(fontSizeInput.value);
        const color = colorInput.value;
        const fontFamily = fontFamilySelect.value;
        
        createTextLayer(text, fontSize, color, fontFamily);
        closeDialog();
        showNotification('✅ 文本已添加', 'success');
    };
    
    // 按钮事件
    cancelBtn.addEventListener('click', closeDialog);
    confirmBtn.addEventListener('click', addText);
    
    // 键盘事件
    const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
            closeDialog();
        } else if (e.key === 'Enter' && e.ctrlKey) {
            addText();
        }
    };
    
    dialogOverlay.addEventListener('keydown', handleKeyDown);
    textArea.addEventListener('keydown', handleKeyDown);
    
    // 点击背景关闭
    dialogOverlay.addEventListener('click', (e) => {
        if (e.target === dialogOverlay) {
            closeDialog();
        }
    });
    
    // 阻止事件冒泡
    dialog.addEventListener('click', (e) => e.stopPropagation());
    
    document.body.appendChild(dialogOverlay);
}

// 创建文本图层
function createTextLayer(text, fontSize, color, fontFamily) {
    // 创建新图层
    const layer = {
        id: layerIdCounter++,
        name: `文本: ${text.substring(0, 10)}${text.length > 10 ? '...' : ''}`,
        visible: true,
        opacity: 1,
        canvas: document.createElement('canvas'),
        ctx: null,
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
        offsetX: 0,
        offsetY: 0,
        mirrorH: false,
        mirrorV: false,
        contentBounds: null,
        originalCanvas: null,
        isTextLayer: true,
        textContent: text,
        fontSize: fontSize,
        fontColor: color,
        fontFamily: fontFamily
    };
    
    // 设置画布尺寸（足够大以容纳文本）
    layer.canvas.width = canvas.width;
    layer.canvas.height = canvas.height;
    layer.ctx = layer.canvas.getContext('2d');
    
    // 设置抗锯齿
    layer.ctx.imageSmoothingEnabled = true;
    layer.ctx.imageSmoothingQuality = 'high';
    
    // 渲染文本
    renderTextToLayer(layer);
    
    // 添加到图层列表
    layers.push(layer);
    currentLayerIndex = layers.length - 1;
    selectedLayerIndices = [currentLayerIndex];
    
    // 保存历史记录
    saveHistory();
    
    // 更新界面
    renderLayerList();
    mergeAndRender();
    
    console.log('[hosepen] 文本图层已创建:', layer.name);
}

// 渲染文本到图层
function renderTextToLayer(layer) {
    const ctx = layer.ctx;
    
    // 清空画布
    ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
    
    // 设置文本样式
    ctx.font = `${layer.fontSize}px ${layer.fontFamily}`;
    ctx.fillStyle = layer.fontColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // 计算文本位置（居中）
    const x = layer.canvas.width / 2;
    const y = layer.canvas.height / 2;
    
    // 处理多行文本
    const lines = layer.textContent.split('\n');
    const lineHeight = layer.fontSize * 1.2;
    const startY = y - (lines.length - 1) * lineHeight / 2;
    
    // 绘制每一行
    lines.forEach((line, index) => {
        ctx.fillText(line, x, startY + index * lineHeight);
    });
    
    // 计算内容边界
    calculateTextBounds(layer);
    
    // 备份原始画布
    layer.originalCanvas = document.createElement('canvas');
    layer.originalCanvas.width = layer.canvas.width;
    layer.originalCanvas.height = layer.canvas.height;
    const originalCtx = layer.originalCanvas.getContext('2d');
    originalCtx.drawImage(layer.canvas, 0, 0);
}

// 计算文本内容边界
function calculateTextBounds(layer) {
    const ctx = layer.ctx;
    ctx.font = `${layer.fontSize}px ${layer.fontFamily}`;
    
    const lines = layer.textContent.split('\n');
    let maxWidth = 0;
    
    // 计算最大宽度
    lines.forEach(line => {
        const metrics = ctx.measureText(line);
        maxWidth = Math.max(maxWidth, metrics.width);
    });
    
    const lineHeight = layer.fontSize * 1.2;
    const totalHeight = lines.length * lineHeight;
    
    // 计算边界（居中）
    const centerX = layer.canvas.width / 2;
    const centerY = layer.canvas.height / 2;
    
    layer.contentBounds = {
        left: centerX - maxWidth / 2,
        top: centerY - totalHeight / 2,
        right: centerX + maxWidth / 2,
        bottom: centerY + totalHeight / 2,
        width: maxWidth,
        height: totalHeight
    };
}

// 重新渲染文本图层（用于颜色修改等）
function rerenderTextLayer(layer, newColor) {
    if (!layer.isTextLayer) return;
    
    // 更新颜色
    if (newColor) {
        layer.fontColor = newColor;
    }
    
    // 重新渲染
    renderTextToLayer(layer);
    
    // 保存历史记录
    saveHistory();
    
    // 更新显示
    mergeAndRender();
}

// 显示文本颜色编辑对话框
function showTextColorEditDialog(layerIndex) {
    const layer = layers[layerIndex];
    if (!layer || !layer.isTextLayer) return;
    
    // 检查是否已存在对话框
    if (document.getElementById('text-color-edit-dialog')) {
        return;
    }
    
    // 创建对话框背景
    const dialogOverlay = document.createElement('div');
    dialogOverlay.id = 'text-color-edit-dialog';
    dialogOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10001;
    `;
    
    // 创建对话框内容
    const dialog = document.createElement('div');
    dialog.style.cssText = `
        background: white;
        border-radius: 12px;
        padding: 25px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
        max-width: 400px;
        width: 90%;
    `;
    
    // 对话框标题
    const title = document.createElement('h3');
    title.textContent = '🎨 修改文本颜色';
    title.style.cssText = `
        margin: 0 0 15px 0;
        color: #333;
        font-size: 18px;
        text-align: center;
    `;
    
    // 文本预览
    const textPreview = document.createElement('div');
    const previewText = layer.textContent.length > 50 ? 
        layer.textContent.substring(0, 50) + '...' : 
        layer.textContent;
    textPreview.textContent = `"${previewText}"`;
    textPreview.style.cssText = `
        background: #f5f5f5;
        padding: 12px;
        border-radius: 8px;
        margin-bottom: 15px;
        font-size: 14px;
        color: #666;
        text-align: center;
        font-style: italic;
    `;
    
    // 颜色选择器容器
    const colorContainer = document.createElement('div');
    colorContainer.style.cssText = `
        margin-bottom: 20px;
    `;
    
    const colorLabel = document.createElement('label');
    colorLabel.textContent = '选择新颜色:';
    colorLabel.style.cssText = `
        display: block;
        margin-bottom: 8px;
        font-weight: 500;
        color: #333;
    `;
    
    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.value = layer.fontColor;
    colorInput.style.cssText = `
        width: 100%;
        height: 50px;
        border: 2px solid #ddd;
        border-radius: 8px;
        cursor: pointer;
        box-sizing: border-box;
    `;
    
    // 实时预览
    const previewContainer = document.createElement('div');
    previewContainer.style.cssText = `
        background: #f9f9f9;
        padding: 15px;
        border-radius: 8px;
        margin-bottom: 20px;
        text-align: center;
    `;
    
    const previewLabel = document.createElement('div');
    previewLabel.textContent = '预览效果:';
    previewLabel.style.cssText = `
        font-size: 12px;
        color: #666;
        margin-bottom: 8px;
    `;
    
    const previewText2 = document.createElement('div');
    previewText2.textContent = previewText;
    previewText2.style.cssText = `
        font-size: ${Math.min(layer.fontSize, 24)}px;
        font-family: ${layer.fontFamily};
        color: ${layer.fontColor};
        font-weight: bold;
    `;
    
    previewContainer.appendChild(previewLabel);
    previewContainer.appendChild(previewText2);
    
    // 颜色变化时更新预览
    colorInput.addEventListener('input', (e) => {
        previewText2.style.color = e.target.value;
    });
    
    colorContainer.appendChild(colorLabel);
    colorContainer.appendChild(colorInput);
    
    // 按钮容器
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
        display: flex;
        gap: 10px;
        justify-content: flex-end;
    `;
    
    // 取消按钮
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = '取消';
    cancelBtn.style.cssText = `
        padding: 10px 20px;
        background: #6c757d;
        color: white;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
        transition: background 0.2s;
    `;
    cancelBtn.addEventListener('mouseenter', () => cancelBtn.style.background = '#5a6268');
    cancelBtn.addEventListener('mouseleave', () => cancelBtn.style.background = '#6c757d');
    
    // 确认按钮
    const confirmBtn = document.createElement('button');
    confirmBtn.textContent = '应用';
    confirmBtn.style.cssText = `
        padding: 10px 20px;
        background: #9C27B0;
        color: white;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
        transition: background 0.2s;
    `;
    confirmBtn.addEventListener('mouseenter', () => confirmBtn.style.background = '#7B1FA2');
    confirmBtn.addEventListener('mouseleave', () => confirmBtn.style.background = '#9C27B0');
    
    buttonContainer.appendChild(cancelBtn);
    buttonContainer.appendChild(confirmBtn);
    
    // 组装对话框
    dialog.appendChild(title);
    dialog.appendChild(textPreview);
    dialog.appendChild(colorContainer);
    dialog.appendChild(previewContainer);
    dialog.appendChild(buttonContainer);
    dialogOverlay.appendChild(dialog);
    
    // 事件处理
    const closeDialog = () => {
        document.body.removeChild(dialogOverlay);
    };
    
    const applyColor = () => {
        const newColor = colorInput.value;
        rerenderTextLayer(layer, newColor);
        renderLayerList(); // 更新图层面板中的颜色按钮
        closeDialog();
        showNotification('✅ 文本颜色已修改', 'success');
    };
    
    // 按钮事件
    cancelBtn.addEventListener('click', closeDialog);
    confirmBtn.addEventListener('click', applyColor);
    
    // 键盘事件
    const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
            closeDialog();
        } else if (e.key === 'Enter') {
            applyColor();
        }
    };
    
    dialogOverlay.addEventListener('keydown', handleKeyDown);
    
    // 点击背景关闭
    dialogOverlay.addEventListener('click', (e) => {
        if (e.target === dialogOverlay) {
            closeDialog();
        }
    });
    
    // 阻止事件冒泡
    dialog.addEventListener('click', (e) => e.stopPropagation());
    
    document.body.appendChild(dialogOverlay);
}

// 全局鼠标位置追踪（用于快捷键冲突检测）
document.addEventListener('mousemove', (e) => {
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
});

// ========== Photopea导出到ComfyUI ==========

// 记录最后创建的Photopea节点
let lastPhotopeaNode = null;

// 导出Photopea图像到ComfyUI工作流
function exportPhotopeaToComfyUI(iframe) {
    try {
        console.log('[hosepen] 开始从Photopea导出图像到ComfyUI...');
        
        // 显示加载提示
        const loadingMsg = showLoadingMessage('正在从Photopea获取图像数据...');
        
        // 监听来自Photopea的消息
        const messageHandler = (event) => {
            // 只处理来自Photopea iframe的消息
            if (event.source !== iframe.contentWindow) return;
            
            try {
                const data = event.data;
                console.log('[hosepen] 收到Photopea消息:', typeof data, data instanceof ArrayBuffer ? 'ArrayBuffer' : data);
                
                // 处理ArrayBuffer类型的数据（Photopea返回的图像数据）
                if (data instanceof ArrayBuffer) {
                    console.log('[hosepen] 收到ArrayBuffer图像数据，大小:', data.byteLength);
                    window.removeEventListener('message', messageHandler);
                    loadingMsg.remove();
                    
                    // 将ArrayBuffer转换为base64
                    const bytes = new Uint8Array(data);
                    let binary = '';
                    for (let i = 0; i < bytes.byteLength; i++) {
                        binary += String.fromCharCode(bytes[i]);
                    }
                    const base64 = btoa(binary);
                    const dataUrl = 'data:image/png;base64,' + base64;
                    
                    // 创建PhotopeaLoadImage节点并显示图像
                    createPhotopeaLoadImageNode(dataUrl);
                    return;
                }
                
                // 检查字符串类型的数据
                if (data && typeof data === 'string') {
                    if (data.startsWith('data:image/')) {
                        window.removeEventListener('message', messageHandler);
                        loadingMsg.remove();
                        createPhotopeaLoadImageNode(data);
                        return;
                    } else if (data === 'no-document') {
                        window.removeEventListener('message', messageHandler);
                        loadingMsg.remove();
                        alert('请先在Photopea中打开或创建一个文档');
                        return;
                    }
                }
            } catch (error) {
                console.error('[hosepen] 处理Photopea消息失败:', error);
                window.removeEventListener('message', messageHandler);
                loadingMsg.remove();
                alert('获取图像数据失败: ' + error.message);
            }
        };
        
        window.addEventListener('message', messageHandler);
        
        // 向Photopea发送导出请求
        const exportScript = `
            app.echoToOE = true;
            if (app.activeDocument) {
                app.activeDocument.saveToOE("png");
            } else {
                "no-document";
            }
        `;
        
        iframe.contentWindow.postMessage(exportScript, '*');
        
        // 设置超时处理
        setTimeout(() => {
            window.removeEventListener('message', messageHandler);
            if (document.body.contains(loadingMsg)) {
                loadingMsg.remove();
                alert('获取Photopea图像超时，请重试');
            }
        }, 10000);
        
    } catch (error) {
        console.error('[hosepen] 导出失败:', error);
        alert('导出失败: ' + error.message);
    }
}

// 创建或更新Hosepen Image Output节点
function createHosepenImageOutputNode(imageDataUrl) {
    try {
        console.log('[hosepen] 创建或更新Hosepen Image Output节点...');
        
        // 检查是否在ComfyUI环境中
        if (typeof app === 'undefined' || !app.graph || typeof LiteGraph === 'undefined') {
            console.error('[hosepen] 未检测到ComfyUI环境');
            alert('请在ComfyUI中使用此功能');
            return;
        }
        
        // 从data URL中提取base64数据
        const base64Data = imageDataUrl.split(',')[1];
        const timestamp = Date.now();
        const fileName = `photopea_export_${timestamp}.png`;
        
        console.log('[hosepen] 开始上传图像到服务器...');
        
        // 上传图像到ComfyUI服务器
        uploadImageToComfyUI(base64Data, fileName)
            .then((result) => {
                console.log('[hosepen] 图像上传成功:', result);
                
                // 使用返回的文件名（服务器可能会修改文件名）
                const uploadedFileName = result.name || fileName;
                
                // 创建Hosepen Image Output节点
                return createHosepenOutputNodeInGraph(uploadedFileName);
            })
            .then(() => {
                showSuccessMessage('✅ 已成功添加Hosepen Image Output节点到工作流');
                console.log('[hosepen] Hosepen Image Output节点已添加');
            })
            .catch((error) => {
                console.error('[hosepen] 创建节点失败:', error);
                alert('创建节点失败: ' + error.message);
            });
        
    } catch (error) {
        console.error('[hosepen] 创建节点失败:', error);
        alert('创建节点失败: ' + error.message);
    }
}

// 在图中创建Hosepen Image Output节点
async function createHosepenOutputNodeInGraph(fileName) {
    try {
        // 检查是否已有Photopea导出的Hosepen节点
        if (lastPhotopeaNode && app.graph._nodes.includes(lastPhotopeaNode)) {
            console.log('[hosepen] 找到已存在的Hosepen节点，更新图像...');
            
            // 更新现有节点的图像文件名
            if (lastPhotopeaNode.widgets && lastPhotopeaNode.widgets[0]) {
                lastPhotopeaNode.widgets[0].value = fileName;
            }
            
            // 选中并居中显示节点
            app.canvas.selectNode(lastPhotopeaNode);
            app.canvas.centerOnNode(lastPhotopeaNode);
            
            // 刷新画布
            app.graph.setDirtyCanvas(true, true);
            
            showSuccessMessage('✅ 已更新Hosepen Image Output节点');
            console.log('[hosepen] Hosepen Image Output节点已更新');
            return;
        }
        
        // 创建新的Hosepen Image Output节点
        console.log('[hosepen] 创建新的Hosepen Image Output节点...');
        
        const node = LiteGraph.createNode("comfy_hosepen");
        
        if (!node) {
            console.error('[hosepen] 无法创建comfy_hosepen节点');
            alert('Hosepen Image Output节点未找到，请确保插件已正确安装');
            return;
        }
        
        // 计算节点位置
        const nodes = app.graph._nodes || [];
        let maxX = 100;
        let maxY = 100;
        
        nodes.forEach(n => {
            if (n.pos) {
                maxX = Math.max(maxX, n.pos[0] + (n.size ? n.size[0] : 200));
                maxY = Math.max(maxY, n.pos[1]);
            }
        });
        
        node.pos = [maxX + 50, maxY];
        
        // 设置图像文件名
        if (node.widgets && node.widgets[0]) {
            node.widgets[0].value = fileName;
        }
        
        // 添加节点到图形
        app.graph.add(node);
        app.graph.setDirtyCanvas(true, true);
        
        // 选中新创建的节点
        app.canvas.selectNode(node);
        
        // 记录这个节点
        lastPhotopeaNode = node;
        
        console.log('[hosepen] Hosepen Image Output节点已添加');
        
    } catch (error) {
        console.error('[hosepen] 创建Hosepen节点失败:', error);
        throw error;
    }
}

// 创建或更新Photopea Image Output节点
function createPhotopeaLoadImageNode(imageDataUrl) {
    try {
        console.log('[hosepen] 创建或更新Photopea Image Output节点...');
        
        // 检查是否在ComfyUI环境中
        if (typeof app === 'undefined' || !app.graph || typeof LiteGraph === 'undefined') {
            console.error('[hosepen] 未检测到ComfyUI环境');
            alert('请在ComfyUI中使用此功能');
            return;
        }
        
        // 从data URL中提取base64数据
        const base64Data = imageDataUrl.split(',')[1];
        const timestamp = Date.now();
        const fileName = `photopea_export_${timestamp}.png`;
        
        console.log('[hosepen] 开始上传图像到服务器...');
        
        // 上传图像到ComfyUI服务器
        uploadImageToComfyUI(base64Data, fileName)
            .then((result) => {
                console.log('[hosepen] 图像上传成功:', result);
                
                // 使用返回的文件名（服务器可能会修改文件名）
                const uploadedFileName = result.name || fileName;
                
                // 创建Photopea Image Output节点
                return createPhotopeaOutputNodeInGraph(uploadedFileName);
            })
            .then(() => {
                showSuccessMessage('✅ 已成功添加Photopea Image Output节点到工作流');
                console.log('[hosepen] Photopea Image Output节点已添加');
            })
            .catch((error) => {
                console.error('[hosepen] 创建节点失败:', error);
                alert('创建节点失败: ' + error.message);
            });
        
    } catch (error) {
        console.error('[hosepen] 创建节点失败:', error);
        alert('创建节点失败: ' + error.message);
    }
}

// 在图中创建Photopea Image Output节点
async function createPhotopeaOutputNodeInGraph(fileName) {
    try {
        // 检查是否已有Photopea导出的节点
        if (lastPhotopeaNode && app.graph._nodes.includes(lastPhotopeaNode)) {
            console.log('[hosepen] 找到已存在的Photopea节点，更新图像...');
            
            // 更新现有节点的图像文件名
            if (lastPhotopeaNode.widgets && lastPhotopeaNode.widgets[0]) {
                lastPhotopeaNode.widgets[0].value = fileName;
            }
            
            // 刷新画布（不移动视图）
            app.graph.setDirtyCanvas(true, true);
            
            showSuccessMessage('✅ 已更新Photopea Image Output节点');
            console.log('[hosepen] Photopea Image Output节点已更新');
            return;
        }
        
        // 创建新的Photopea Image Output节点
        console.log('[hosepen] 创建新的Photopea Image Output节点...');
        
        const node = LiteGraph.createNode("PhotopeaImageOutput");
        
        if (!node) {
            console.error('[hosepen] 无法创建PhotopeaImageOutput节点');
            alert('Photopea Image Output节点未找到，请重启ComfyUI');
            return;
        }
        
        // 计算节点位置
        const nodes = app.graph._nodes || [];
        let maxX = 100;
        let maxY = 100;
        
        nodes.forEach(n => {
            if (n.pos) {
                maxX = Math.max(maxX, n.pos[0] + (n.size ? n.size[0] : 200));
                maxY = Math.max(maxY, n.pos[1]);
            }
        });
        
        node.pos = [maxX + 50, maxY];
        
        // 设置图像文件名
        if (node.widgets && node.widgets[0]) {
            node.widgets[0].value = fileName;
        }
        
        // 添加节点到图形
        app.graph.add(node);
        app.graph.setDirtyCanvas(true, true);
        
        // 记录这个节点（不自动选中，避免移动视图）
        lastPhotopeaNode = node;
        
        console.log('[hosepen] Photopea Image Output节点已添加');
        
    } catch (error) {
        console.error('[hosepen] 创建Photopea节点失败:', error);
        throw error;
    }
}

// 旧的PhotopeaLoadImage节点创建函数（保留以防需要）
function createPhotopeaLoadImageNodeOld(imageDataUrl) {
    try {
        console.log('[hosepen] 创建或更新PhotopeaLoadImage节点...');
        
        // 检查是否在ComfyUI环境中
        if (typeof app === 'undefined' || !app.graph || typeof LiteGraph === 'undefined') {
            console.error('[hosepen] 未检测到ComfyUI环境');
            alert('请在ComfyUI中使用此功能');
            return;
        }
        
        console.log('[hosepen] 检查节点类型是否已注册...');
        console.log('[hosepen] LiteGraph.registered_node_types:', typeof LiteGraph.registered_node_types);
        
        if (LiteGraph.registered_node_types) {
            const isRegistered = 'PhotopeaLoadImage' in LiteGraph.registered_node_types;
            console.log('[hosepen] PhotopeaLoadImage是否已注册:', isRegistered);
            
            if (!isRegistered) {
                console.log('[hosepen] 节点未注册，尝试注册...');
                registerPhotopeaLoadImageNode();
            }
        }
        
        // 检查是否已有Photopea节点且节点仍在图中
        if (lastPhotopeaNode && app.graph._nodes.includes(lastPhotopeaNode)) {
            console.log('[hosepen] 找到已存在的Photopea节点，更新图像...');
            
            // 更新现有节点的图像
            if (lastPhotopeaNode.setImageData) {
                lastPhotopeaNode.setImageData(imageDataUrl);
            }
            
            // 选中并居中显示节点
            app.canvas.selectNode(lastPhotopeaNode);
            app.canvas.centerOnNode(lastPhotopeaNode);
            
            // 刷新画布
            app.graph.setDirtyCanvas(true, true);
            
            showSuccessMessage('✅ 已更新Photopea图像节点');
            console.log('[hosepen] Photopea图像节点已更新');
            return;
        }
        
        // 如果没有现有节点，创建新节点
        console.log('[hosepen] 创建新的Photopea节点...');
        console.log('[hosepen] 检查LiteGraph.registered_node_types:', typeof LiteGraph.registered_node_types);
        
        // 检查节点类型是否已注册
        if (typeof LiteGraph.registered_node_types !== 'undefined') {
            console.log('[hosepen] 已注册的节点类型:', Object.keys(LiteGraph.registered_node_types));
            console.log('[hosepen] PhotopeaLoadImage是否已注册:', 'PhotopeaLoadImage' in LiteGraph.registered_node_types);
        }
        
        const node = LiteGraph.createNode("PhotopeaLoadImage");
        
        if (!node) {
            console.error('[hosepen] 无法创建PhotopeaLoadImage节点');
            console.error('[hosepen] 可能原因：节点类型未注册或注册失败');
            
            // 尝试重新注册
            console.log('[hosepen] 尝试重新注册节点...');
            if (registerPhotopeaLoadImageNode()) {
                console.log('[hosepen] 重新注册成功，再次尝试创建节点');
                const retryNode = LiteGraph.createNode("PhotopeaLoadImage");
                if (retryNode) {
                    console.log('[hosepen] 重试成功！');
                    // 继续使用retryNode
                    const nodes = app.graph._nodes || [];
                    let maxX = 100;
                    let maxY = 100;
                    
                    nodes.forEach(n => {
                        if (n.pos) {
                            maxX = Math.max(maxX, n.pos[0] + (n.size ? n.size[0] : 200));
                            maxY = Math.max(maxY, n.pos[1]);
                        }
                    });
                    
                    retryNode.pos = [maxX + 50, maxY];
                    retryNode.title = "Photopea Image";
                    
                    if (retryNode.setImageData) {
                        retryNode.setImageData(imageDataUrl);
                    }
                    
                    app.graph.add(retryNode);
                    app.graph.setDirtyCanvas(true, true);
                    app.canvas.selectNode(retryNode);
                    lastPhotopeaNode = retryNode;
                    
                    showSuccessMessage('✅ 已成功添加Photopea图像节点到工作流');
                    console.log('[hosepen] Photopea图像节点已添加');
                    return;
                }
            }
            
            alert('PhotopeaLoadImage节点未注册，请刷新页面重试');
            return;
        }
        
        // 计算节点位置
        const nodes = app.graph._nodes || [];
        let maxX = 100;
        let maxY = 100;
        
        nodes.forEach(n => {
            if (n.pos) {
                maxX = Math.max(maxX, n.pos[0] + (n.size ? n.size[0] : 200));
                maxY = Math.max(maxY, n.pos[1]);
            }
        });
        
        node.pos = [maxX + 50, maxY];
        node.title = "Photopea Image";
        
        // 将图像数据存储到节点
        if (node.setImageData) {
            node.setImageData(imageDataUrl);
        }
        
        // 添加节点到图形
        app.graph.add(node);
        app.graph.setDirtyCanvas(true, true);
        
        // 选中新创建的节点
        app.canvas.selectNode(node);
        
        // 记录这个节点
        lastPhotopeaNode = node;
        
        showSuccessMessage('✅ 已成功添加Photopea图像节点到工作流');
        console.log('[hosepen] Photopea图像节点已添加');
        
    } catch (error) {
        console.error('[hosepen] 创建节点失败:', error);
        alert('创建节点失败: ' + error.message);
    }
}

// 注册自定义PhotopeaLoadImage节点
function registerPhotopeaLoadImageNode() {
    if (typeof LiteGraph === 'undefined') {
        console.log('[hosepen] LiteGraph未加载，稍后重试注册节点');
        return false;
    }
    
    // 检查是否已经注册过
    if (LiteGraph.registered_node_types && LiteGraph.registered_node_types["PhotopeaLoadImage"]) {
        console.log('[hosepen] PhotopeaLoadImage节点已存在，跳过注册');
        return true;
    }
    
    // 定义PhotopeaLoadImage节点类（使用函数式定义，兼容LiteGraph）
    function PhotopeaLoadImage() {
        this.addOutput("IMAGE", "IMAGE");
        this.addOutput("MASK", "MASK");
        this.properties = {
            image_data: ""
        };
        this.size = [320, 314];
        this.imageElement = null;
    }
    
    PhotopeaLoadImage.title = "Photopea Load Image";
    PhotopeaLoadImage.desc = "从Photopea加载图像";
    
    // 节点被移除时的处理
    PhotopeaLoadImage.prototype.onRemoved = function() {
        if (lastPhotopeaNode === this) {
            lastPhotopeaNode = null;
            console.log('[hosepen] Photopea节点已删除，清除记录');
        }
    };
    
    // 设置图像数据
    PhotopeaLoadImage.prototype.setImageData = function(dataUrl) {
        this.properties.image_data = dataUrl;
        
        if (!this.imageElement) {
            this.imageElement = new Image();
        }
        
        this.imageElement.src = dataUrl;
        this.imageElement.onload = () => {
            if (this.graph) {
                this.graph.setDirtyCanvas(true, true);
            }
        };
    };
    
    // 绘制节点
    PhotopeaLoadImage.prototype.onDrawBackground = function(ctx) {
        if (this.flags.collapsed) return;
        
        if (this.imageElement && this.imageElement.complete) {
            const imgWidth = this.imageElement.width;
            const imgHeight = this.imageElement.height;
            
            const maxWidth = this.size[0] - 20;
            const maxHeight = this.size[1] - 60;
            
            let scale = Math.min(maxWidth / imgWidth, maxHeight / imgHeight);
            scale = Math.min(scale, 1);
            
            const drawWidth = imgWidth * scale;
            const drawHeight = imgHeight * scale;
            
            const x = (this.size[0] - drawWidth) / 2;
            const y = 30;
            
            ctx.drawImage(this.imageElement, x, y, drawWidth, drawHeight);
        } else {
            ctx.fillStyle = "#666";
            ctx.font = "14px Arial";
            ctx.textAlign = "center";
            ctx.fillText("Photopea Image", this.size[0] / 2, this.size[1] / 2);
        }
    };
    
    // 序列化
    PhotopeaLoadImage.prototype.onSerialize = function(o) {
        o.image_data = this.properties.image_data;
    };
    
    // 反序列化
    PhotopeaLoadImage.prototype.onConfigure = function(o) {
        if (o.image_data) {
            this.setImageData(o.image_data);
        }
    };
    
    // 注册节点
    LiteGraph.registerNodeType("PhotopeaLoadImage", PhotopeaLoadImage);
    console.log('[hosepen] PhotopeaLoadImage节点已注册');
    return true;
}

// 尝试注册自定义节点
function tryRegisterPhotopeaNode() {
    if (registerPhotopeaLoadImageNode()) {
        console.log('[hosepen] PhotopeaLoadImage节点注册成功');
        return true;
    } else {
        // 如果LiteGraph还未加载，等待后重试
        console.log('[hosepen] LiteGraph未加载，等待重试...');
        setTimeout(tryRegisterPhotopeaNode, 500);
        return false;
    }
}

// 等待ComfyUI加载完成后注册节点
function waitForComfyUIAndRegister() {
    if (typeof app !== 'undefined' && app.graph && typeof LiteGraph !== 'undefined') {
        console.log('[hosepen] ComfyUI已加载，开始注册PhotopeaLoadImage节点');
        console.log('[hosepen] app:', typeof app);
        console.log('[hosepen] app.graph:', typeof app.graph);
        console.log('[hosepen] LiteGraph:', typeof LiteGraph);
        tryRegisterPhotopeaNode();
        
        // 注册完成后验证
        setTimeout(() => {
            if (typeof LiteGraph !== 'undefined' && LiteGraph.registered_node_types) {
                const isRegistered = 'PhotopeaLoadImage' in LiteGraph.registered_node_types;
                console.log('[hosepen] ===== 节点注册验证 =====');
                console.log('[hosepen] PhotopeaLoadImage是否已注册:', isRegistered);
                if (isRegistered) {
                    console.log('[hosepen] ✅ 节点注册成功！');
                    console.log('[hosepen] 可以在ComfyUI中右键 -> Add Node 搜索 "Photopea" 找到节点');
                } else {
                    console.error('[hosepen] ❌ 节点注册失败！');
                    console.log('[hosepen] 已注册的节点:', Object.keys(LiteGraph.registered_node_types).filter(k => k.includes('Load')));
                }
            }
        }, 1000);
    } else {
        console.log('[hosepen] 等待ComfyUI加载...');
        setTimeout(waitForComfyUIAndRegister, 500);
    }
}

// 使用ComfyUI的扩展系统注册
const ext = {
    name: "hosepen.PhotopeaLoadImage",
    async init(app) {
        console.log('[hosepen] ComfyUI扩展初始化...');
    },
    async setup(app) {
        console.log('[hosepen] ComfyUI扩展setup...');
        
        // 在这里注册自定义节点
        if (typeof LiteGraph !== 'undefined') {
            console.log('[hosepen] 开始注册PhotopeaLoadImage节点');
            registerPhotopeaLoadImageNode();
            
            // 验证注册
            setTimeout(() => {
                if (LiteGraph.registered_node_types && 'PhotopeaLoadImage' in LiteGraph.registered_node_types) {
                    console.log('[hosepen] ✅ PhotopeaLoadImage节点注册成功！');
                } else {
                    console.error('[hosepen] ❌ PhotopeaLoadImage节点注册失败！');
                }
            }, 100);
        }
    },
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        // 可以在这里修改节点定义
    },
    async nodeCreated(node) {
        // 节点创建时的回调
    }
};

// 注册扩展
if (typeof app !== 'undefined' && app.registerExtension) {
    app.registerExtension(ext);
    console.log('[hosepen] 已注册ComfyUI扩展');
} else {
    console.log('[hosepen] app.registerExtension不可用，使用传统方式初始化');
    // 传统方式初始化
    setTimeout(() => {
        waitForComfyUIAndRegister();
    }, 100);
}

// 初始化悬浮按钮（独立于节点注册）
setTimeout(() => {
    createButton();
    console.log('[hosepen] 悬浮按钮已创建');
    console.log('[hosepen] 插件初始化完成');
}, 100);
