// 预测事件API路由 - 处理GET和POST请求
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, supabase, type Prediction } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    // 对于获取预测事件列表，允许匿名访问（不需要登录）
    // 只有创建预测事件等敏感操作才需要登录验证

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const status = searchParams.get('status');
    const limit = searchParams.get('limit');

    // 在缺少服务密钥时使用匿名客户端降级读取
    const client = supabaseAdmin || supabase;

    // 构建Supabase查询
    let query = client
      .from('predictions')
      .select('*')
      .order('created_at', { ascending: false });
    
    // 添加过滤条件
    if (category) {
      query = query.eq('category', category);
    }
    
    if (status) {
      query = query.eq('status', status);
    }
    
    if (limit) {
      const limitNum = parseInt(limit);
      query = query.limit(limitNum);
    }
    
    const { data: predictions, error } = await query;
    
    // 获取每个预测的关注数量（在缺少服务密钥时尝试匿名读取，失败则将计数置为0）
    let predictionsWithFollowersCount = [];
    if (!error && predictions) {
      predictionsWithFollowersCount = await Promise.all(
        predictions.map(async (prediction) => {
          // 获取关注数量
          const countClient = supabaseAdmin || supabase;
          const { count, error: countError } = await countClient
            .from('event_follows')
            .select('id', { count: 'exact', head: true })
            .eq('event_id', prediction.id);
          
          return {
            ...prediction,
            followers_count: countError ? 0 : (count || 0)
          };
        })
      );
    }

    if (error) {
      console.error('获取预测事件列表失败:', error);
      return NextResponse.json({ success: false, message: '获取预测事件列表失败' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: predictionsWithFollowersCount,
      message: '获取预测事件列表成功'
    }, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8'
      }
    });
    
  } catch (error) {
    console.error('获取预测事件列表异常:', error);
    return NextResponse.json({ success: false, message: '获取预测事件列表失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // 解析请求体中的JSON数据
    const body = await request.json();
    
    // 验证用户是否已登录（钱包地址）
    const walletAddress = body.walletAddress;
    if (!walletAddress) {
      return NextResponse.json(
        { 
          success: false, 
          message: '请先连接钱包登录' 
        },
        { status: 401 }
      );
    }
    
    // 验证钱包地址格式
    const ethAddressRegex = /^0x[a-fA-F0-9]{40}$/;
    if (!ethAddressRegex.test(walletAddress)) {
      return NextResponse.json(
        { 
          success: false, 
          message: '无效的钱包地址格式' 
        },
        { status: 400 }
      );
    }
    
    // 验证必填字段
    const requiredFields = ['title', 'description', 'category', 'deadline', 'minStake', 'criteria'];
    const missingFields = requiredFields.filter(field => !body[field]);
    
    if (missingFields.length > 0) {
      return NextResponse.json(
        { 
          success: false, 
          message: '缺少必填字段', 
          missingFields 
        },
        { status: 400 }
      );
    }
    
    // 验证数据类型
    if (typeof body.minStake !== 'number' || body.minStake <= 0) {
      return NextResponse.json(
        { success: false, message: '最小押注必须是大于0的数字' },
        { status: 400 }
      );
    }
    
    // 检查是否已存在相同标题的预测事件
    const { data: existingPredictions, error: checkError } = await supabaseAdmin
      .from('predictions')
      .select('id, title, description, category, deadline, status')
      .eq('title', body.title);
    
    if (checkError) {
      console.error('检查重复标题失败:', checkError);
      return NextResponse.json(
        { success: false, message: '检查预测事件失败' },
        { status: 500 }
      );
    }
    
    // 如果存在相同标题的预测事件，返回错误并列出所有重复事件
    if (existingPredictions && existingPredictions.length > 0) {
      return NextResponse.json(
        { 
          success: false, 
          message: '已存在相同标题的预测事件，请修改标题或删除现有事件',
          duplicateEvents: existingPredictions.map(event => ({
            id: event.id,
            title: event.title,
            category: event.category,
            status: event.status,
            deadline: event.deadline
          }))
        },
        { status: 409 } // 409 Conflict 状态码
      );
    }
    
    // 验证图片URL（如果提供了）
    if (body.imageUrl && typeof body.imageUrl !== 'string') {
      return NextResponse.json(
        { success: false, message: '图片URL格式无效' },
        { status: 400 }
      );
    }

    // 优先使用上传的图片URL，如果没有上传则使用生成的图片
    let imageUrl: string;
    if (body.imageUrl) {
      // 如果imageUrl包含supabase.co，说明是上传的图片
      if (body.imageUrl.includes('supabase.co')) {
        imageUrl = body.imageUrl;
      } else if (body.imageUrl.startsWith('https://')) {
        imageUrl = body.imageUrl;
      } else {
        // 生成基于标题的图片URL
        const seed = body.title.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'prediction';
        imageUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(seed)}&size=400&backgroundColor=b6e3f4,c0aede,d1d4f9&radius=20`;
      }
    } else {
      // 如果没有提供图片URL，根据标题生成图片
      const seed = body.title.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'prediction';
      imageUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(seed)}&size=400&backgroundColor=b6e3f4,c0aede,d1d4f9&radius=20`;
    }

    // 插入新的预测事件到Supabase数据库
    // 先获取当前最大id，然后手动指定id来避免序列冲突
    const { data: maxIdData, error: maxIdError } = await supabaseAdmin
      .from('predictions')
      .select('id')
      .order('id', { ascending: false })
      .limit(1);
    
    if (maxIdError) {
      console.error('获取最大ID失败:', maxIdError);
      return NextResponse.json(
        { success: false, message: '创建预测事件失败' },
        { status: 500 }
      );
    }
    
    const nextId = maxIdData.length > 0 ? maxIdData[0].id + 1 : 1;
    
    const { data: newPrediction, error } = await supabaseAdmin
      .from('predictions')
      .insert({
        id: nextId, // 手动指定id，避免序列冲突
        title: body.title,
        description: body.description,
        category: body.category,
        deadline: body.deadline,
        min_stake: body.minStake,
        criteria: body.criteria,
        reference_url: body.reference_url || '',
        image_url: imageUrl,
        status: 'active'
      })
      .select()
      .single();
    
    if (error) {
      console.error('创建预测事件失败:', error);
      return NextResponse.json(
        { success: false, message: '创建预测事件失败' },
        { status: 500 }
      );
    }
    
    // 返回成功响应
    return NextResponse.json({
      success: true,
      data: newPrediction,
      message: '预测事件创建成功'
    }, { status: 201 }); // 201表示资源创建成功
    
  } catch (error) {
    // 错误处理
    console.error('创建预测事件异常:', error);
    return NextResponse.json(
      { success: false, message: '创建预测事件失败', error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}