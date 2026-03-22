const express = require('express');
const router = express.Router();

module.exports = function({ db, logger, authenticateUser, requireAdmin }) {
  const { asyncHandler, AppError } = require('../middleware/errorHandler');

  // ============================================
  // HELPERS
  // ============================================

  function validateNumericId(id, paramName = 'id') {
    const num = parseInt(id, 10);
    if (isNaN(num) || num <= 0 || String(num) !== String(id)) {
      throw new AppError(`Invalid ${paramName}: must be a positive integer`, 400);
    }
    return num;
  }

  function parsePagination(query, defaultLimit = 20, maxLimit = 100) {
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.min(maxLimit, Math.max(1, parseInt(query.limit, 10) || defaultLimit));
    const offset = (page - 1) * limit;
    return { page, limit, offset };
  }

  function paginationMeta(page, limit, total) {
    return {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasMore: page * limit < total
    };
  }

  // ============================================
  // PUBLIC ROUTES (no auth needed)
  // ============================================

  /**
   * GET /kb/categories — list active categories with article counts
   */
  router.get('/kb/categories', asyncHandler(async (req, res) => {
    const categories = await db.query(`
      SELECT c.id, c.name, c.slug, c.description, c.icon, c.sort_order,
             COUNT(CASE WHEN a.is_published = 1 THEN a.id END) AS article_count
      FROM kb_categories c
      LEFT JOIN kb_articles a ON a.category_id = c.id
      WHERE c.is_active = 1
      GROUP BY c.id
      ORDER BY c.sort_order ASC
    `);

    res.json({ categories });
  }));

  /**
   * GET /kb/articles — list published articles
   * Query: ?category=slug&search=term&page=1&limit=10
   */
  router.get('/kb/articles', asyncHandler(async (req, res) => {
    const { page, limit, offset } = parsePagination(req.query, 10);
    const { category, search } = req.query;

    let where = 'WHERE a.is_published = 1';
    const params = [];

    if (category) {
      where += ' AND c.slug = ?';
      params.push(category);
    }

    if (search && search.trim()) {
      where += ' AND MATCH(a.title, a.content) AGAINST(? IN BOOLEAN MODE)';
      params.push(search.trim() + '*');
    }

    // Count total
    const countSql = `
      SELECT COUNT(*) AS total
      FROM kb_articles a
      JOIN kb_categories c ON c.id = a.category_id
      ${where}
    `;
    const countResult = await db.queryOne(countSql, params);
    const total = countResult ? countResult.total : 0;

    // Fetch articles
    let selectExtra = '';
    if (search && search.trim()) {
      selectExtra = ', MATCH(a.title, a.content) AGAINST(? IN BOOLEAN MODE) AS relevance';
    }

    const dataSql = `
      SELECT a.id, a.category_id, c.name AS category_name, c.slug AS category_slug,
             a.title, a.slug, a.excerpt, a.tags, a.views, a.helpful_yes, a.helpful_no,
             a.is_published, a.created_at, a.updated_at
             ${selectExtra}
      FROM kb_articles a
      JOIN kb_categories c ON c.id = a.category_id
      ${where}
      ORDER BY ${search && search.trim() ? 'relevance DESC,' : ''} a.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const dataParams = search && search.trim()
      ? [search.trim() + '*', ...params, limit, offset]
      : [...params, limit, offset];

    const articles = await db.query(dataSql, dataParams);

    // Parse tags JSON
    for (const article of articles) {
      if (article.tags && typeof article.tags === 'string') {
        try { article.tags = JSON.parse(article.tags); } catch { article.tags = []; }
      }
    }

    res.json({
      articles,
      pagination: paginationMeta(page, limit, total)
    });
  }));

  /**
   * GET /kb/articles/:slug — get single article by slug
   */
  router.get('/kb/articles/:slug', asyncHandler(async (req, res) => {
    const { slug } = req.params;

    const article = await db.queryOne(`
      SELECT a.*, c.name AS category_name, c.slug AS category_slug
      FROM kb_articles a
      JOIN kb_categories c ON c.id = a.category_id
      WHERE a.slug = ? AND a.is_published = 1
      LIMIT 1
    `, [slug]);

    if (!article) {
      throw new AppError('Článek nebyl nalezen', 404);
    }

    // Parse tags
    if (article.tags && typeof article.tags === 'string') {
      try { article.tags = JSON.parse(article.tags); } catch { article.tags = []; }
    }

    // Increment views (fire-and-forget)
    db.query('UPDATE kb_articles SET views = views + 1 WHERE id = ?', [article.id]).catch(() => {});

    res.json({ article });
  }));

  /**
   * POST /kb/articles/:id/helpful — rate article helpfulness
   * Body: { helpful: true/false }
   */
  router.post('/kb/articles/:id/helpful', asyncHandler(async (req, res) => {
    const id = validateNumericId(req.params.id);
    const { helpful } = req.body;

    if (typeof helpful !== 'boolean') {
      throw new AppError('Parameter "helpful" musí být boolean', 400);
    }

    const column = helpful ? 'helpful_yes' : 'helpful_no';
    await db.query(`UPDATE kb_articles SET ${column} = ${column} + 1 WHERE id = ? AND is_published = 1`, [id]);

    res.json({ success: true });
  }));

  // ============================================
  // ADMIN ROUTES
  // ============================================

  /**
   * GET /admin/kb/articles — list all articles including unpublished
   */
  router.get('/admin/kb/articles', authenticateUser, requireAdmin, asyncHandler(async (req, res) => {
    const { page, limit, offset } = parsePagination(req.query, 20);

    const countResult = await db.queryOne('SELECT COUNT(*) AS total FROM kb_articles');
    const total = countResult ? countResult.total : 0;

    const articles = await db.query(`
      SELECT a.*, c.name AS category_name, c.slug AS category_slug
      FROM kb_articles a
      JOIN kb_categories c ON c.id = a.category_id
      ORDER BY a.updated_at DESC
      LIMIT ? OFFSET ?
    `, [limit, offset]);

    for (const article of articles) {
      if (article.tags && typeof article.tags === 'string') {
        try { article.tags = JSON.parse(article.tags); } catch { article.tags = []; }
      }
    }

    res.json({
      articles,
      pagination: paginationMeta(page, limit, total)
    });
  }));

  /**
   * POST /admin/kb/articles — create article
   */
  router.post('/admin/kb/articles', authenticateUser, requireAdmin, asyncHandler(async (req, res) => {
    const { category_id, title, slug, content, excerpt, tags, is_published } = req.body;

    if (!category_id || !title || !slug || !content) {
      throw new AppError('Pole category_id, title, slug a content jsou povinná', 400);
    }

    // Check slug uniqueness
    const existing = await db.queryOne('SELECT id FROM kb_articles WHERE slug = ?', [slug]);
    if (existing) {
      throw new AppError('Článek s tímto slugem již existuje', 409);
    }

    const result = await db.query(`
      INSERT INTO kb_articles (category_id, title, slug, content, excerpt, tags, is_published, author_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      category_id, title, slug, content,
      excerpt || null,
      tags ? JSON.stringify(tags) : null,
      is_published !== false ? 1 : 0,
      req.user?.id || null
    ]);

    const article = await db.queryOne('SELECT * FROM kb_articles WHERE id = ?', [result.insertId]);

    logger.info('KB article created', { articleId: result.insertId, title, userId: req.user?.id });

    res.status(201).json({ success: true, article });
  }));

  /**
   * PUT /admin/kb/articles/:id — update article
   */
  router.put('/admin/kb/articles/:id', authenticateUser, requireAdmin, asyncHandler(async (req, res) => {
    const id = validateNumericId(req.params.id);
    const { category_id, title, slug, content, excerpt, tags, is_published } = req.body;

    const existing = await db.queryOne('SELECT id FROM kb_articles WHERE id = ?', [id]);
    if (!existing) {
      throw new AppError('Článek nebyl nalezen', 404);
    }

    // Check slug uniqueness if changed
    if (slug) {
      const slugConflict = await db.queryOne('SELECT id FROM kb_articles WHERE slug = ? AND id != ?', [slug, id]);
      if (slugConflict) {
        throw new AppError('Článek s tímto slugem již existuje', 409);
      }
    }

    const updates = [];
    const params = [];

    if (category_id !== undefined) { updates.push('category_id = ?'); params.push(category_id); }
    if (title !== undefined) { updates.push('title = ?'); params.push(title); }
    if (slug !== undefined) { updates.push('slug = ?'); params.push(slug); }
    if (content !== undefined) { updates.push('content = ?'); params.push(content); }
    if (excerpt !== undefined) { updates.push('excerpt = ?'); params.push(excerpt || null); }
    if (tags !== undefined) { updates.push('tags = ?'); params.push(tags ? JSON.stringify(tags) : null); }
    if (is_published !== undefined) { updates.push('is_published = ?'); params.push(is_published ? 1 : 0); }

    if (updates.length === 0) {
      throw new AppError('Žádná pole k aktualizaci', 400);
    }

    params.push(id);
    await db.query(`UPDATE kb_articles SET ${updates.join(', ')} WHERE id = ?`, params);

    const article = await db.queryOne(`
      SELECT a.*, c.name AS category_name
      FROM kb_articles a
      JOIN kb_categories c ON c.id = a.category_id
      WHERE a.id = ?
    `, [id]);

    logger.info('KB article updated', { articleId: id, userId: req.user?.id });

    res.json({ success: true, article });
  }));

  /**
   * DELETE /admin/kb/articles/:id — delete article
   */
  router.delete('/admin/kb/articles/:id', authenticateUser, requireAdmin, asyncHandler(async (req, res) => {
    const id = validateNumericId(req.params.id);

    const existing = await db.queryOne('SELECT id, title FROM kb_articles WHERE id = ?', [id]);
    if (!existing) {
      throw new AppError('Článek nebyl nalezen', 404);
    }

    await db.query('DELETE FROM kb_articles WHERE id = ?', [id]);

    logger.info('KB article deleted', { articleId: id, title: existing.title, userId: req.user?.id });

    res.json({ success: true, message: 'Článek byl smazán' });
  }));

  /**
   * POST /admin/kb/categories — create category
   */
  router.post('/admin/kb/categories', authenticateUser, requireAdmin, asyncHandler(async (req, res) => {
    const { name, slug, description, icon, sort_order } = req.body;

    if (!name || !slug) {
      throw new AppError('Pole name a slug jsou povinná', 400);
    }

    const existing = await db.queryOne('SELECT id FROM kb_categories WHERE slug = ?', [slug]);
    if (existing) {
      throw new AppError('Kategorie s tímto slugem již existuje', 409);
    }

    const result = await db.query(`
      INSERT INTO kb_categories (name, slug, description, icon, sort_order)
      VALUES (?, ?, ?, ?, ?)
    `, [name, slug, description || null, icon || null, sort_order || 0]);

    const category = await db.queryOne('SELECT * FROM kb_categories WHERE id = ?', [result.insertId]);

    res.status(201).json({ success: true, category });
  }));

  /**
   * PUT /admin/kb/categories/:id — update category
   */
  router.put('/admin/kb/categories/:id', authenticateUser, requireAdmin, asyncHandler(async (req, res) => {
    const id = validateNumericId(req.params.id);
    const { name, slug, description, icon, sort_order, is_active } = req.body;

    const existing = await db.queryOne('SELECT id FROM kb_categories WHERE id = ?', [id]);
    if (!existing) {
      throw new AppError('Kategorie nebyla nalezena', 404);
    }

    if (slug) {
      const slugConflict = await db.queryOne('SELECT id FROM kb_categories WHERE slug = ? AND id != ?', [slug, id]);
      if (slugConflict) {
        throw new AppError('Kategorie s tímto slugem již existuje', 409);
      }
    }

    const updates = [];
    const params = [];

    if (name !== undefined) { updates.push('name = ?'); params.push(name); }
    if (slug !== undefined) { updates.push('slug = ?'); params.push(slug); }
    if (description !== undefined) { updates.push('description = ?'); params.push(description || null); }
    if (icon !== undefined) { updates.push('icon = ?'); params.push(icon || null); }
    if (sort_order !== undefined) { updates.push('sort_order = ?'); params.push(sort_order); }
    if (is_active !== undefined) { updates.push('is_active = ?'); params.push(is_active ? 1 : 0); }

    if (updates.length === 0) {
      throw new AppError('Žádná pole k aktualizaci', 400);
    }

    params.push(id);
    await db.query(`UPDATE kb_categories SET ${updates.join(', ')} WHERE id = ?`, params);

    const category = await db.queryOne('SELECT * FROM kb_categories WHERE id = ?', [id]);

    res.json({ success: true, category });
  }));

  /**
   * DELETE /admin/kb/categories/:id — delete category (only if no articles)
   */
  router.delete('/admin/kb/categories/:id', authenticateUser, requireAdmin, asyncHandler(async (req, res) => {
    const id = validateNumericId(req.params.id);

    const existing = await db.queryOne('SELECT id, name FROM kb_categories WHERE id = ?', [id]);
    if (!existing) {
      throw new AppError('Kategorie nebyla nalezena', 404);
    }

    const articleCount = await db.queryOne('SELECT COUNT(*) AS cnt FROM kb_articles WHERE category_id = ?', [id]);
    if (articleCount && articleCount.cnt > 0) {
      throw new AppError('Nelze smazat kategorii, která obsahuje články. Nejprve přesuňte nebo smažte články.', 400);
    }

    await db.query('DELETE FROM kb_categories WHERE id = ?', [id]);

    logger.info('KB category deleted', { categoryId: id, name: existing.name, userId: req.user?.id });

    res.json({ success: true, message: 'Kategorie byla smazána' });
  }));

  return router;
};
