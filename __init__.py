# -*- coding: utf-8 -*-
"""
hosepen - ComfyUI实时绘画插件
可以在浏览器中实时绘画
"""

from .nodes import NODE_CLASS_MAPPINGS, NODE_DISPLAY_NAME_MAPPINGS
from .server import add_routes

__all__ = ['NODE_CLASS_MAPPINGS', 'NODE_DISPLAY_NAME_MAPPINGS']

# Web目录
WEB_DIRECTORY = "./web"

# 版本信息
__version__ = "1.0.0"
__author__ = "Horse Team"
__description__ = "hosepen - ComfyUI实时绘画插件"

print(f"[hosepen] v{__version__} - {__description__}")
print(f"[hosepen] 正在加载插件...")

# ComfyUI路由注册
try:
    from server import PromptServer
    
    @PromptServer.instance.routes.get('/hosepen/api/drawings')
    async def get_drawings_route(request):
        from .server import hosepen_server
        return await hosepen_server.get_drawings(request)
    
    @PromptServer.instance.routes.post('/hosepen/api/drawings')
    async def save_drawing_route(request):
        from .server import hosepen_server
        return await hosepen_server.save_drawing(request)
    
    print("[hosepen] 路由注册成功")
except Exception as e:
    print(f"[hosepen] 路由注册失败: {e}")
    
    # 备用方式
    def setup_routes(routes):
        """为ComfyUI设置路由"""
        try:
            add_routes(routes)
            print("[hosepen] 路由注册成功（备用方式）")
        except Exception as e:
            print(f"[hosepen] 路由注册失败: {e}")
    
    __all__.append('setup_routes')
