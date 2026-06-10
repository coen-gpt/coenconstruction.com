import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";
import { Plus, Trash2, Edit2, Sparkles, Settings, BookOpen, X, Check, RefreshCw, Calendar, Clock, Power, Image } from "lucide-react";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import TurnstileWidget from "@/components/security/TurnstileWidget";
import { formatBlogContent } from "@/lib/blogContent";

const DEFAULT_PROMPT = `You are an experienced content writer for Coen Construction, a family-owned Greater Boston MA general contractor (based in Stoughton, serving the area since 2010) specializing in home additions, decks, siding, kitchen remodeling, custom carpentry, and snow removal. Write a complete, publish-ready, SEO-optimized blog post about: "{topic}".

Write exactly like a knowledgeable human contractor who genuinely wants to help homeowners. The tone should be warm, conversational, and expert — not robotic or overly formal. The article must be COMPLETE and polished: no placeholders, no notes to the editor, no unfinished sections, no filler.

CRITICAL FORMATTING RULES — follow these exactly:
- Output the content field as valid, clean HTML using ONLY these tags: <p>, <h2>, <h3>, <ul>, <ol>, <li>, <strong>, <em>, <a>
- NEVER use markdown of any kind: no # headings, no ** or * emphasis, no - or * bullet lines, no [text](url) links, no backticks, no pipes, no tables
- NEVER use emojis, decorative symbols, or unusual special characters. Use plain English punctuation only. Special characters are allowed only where the topic genuinely requires them (for example $ in prices or % in percentages)
- Paragraphs must be wrapped in <p> tags
- Lists must use <ul><li> or <ol><li>
- Section headings must use <h2> or <h3> tags

HYPERLINK RULES — this is important:
- Throughout the post, naturally hyperlink relevant keywords using <a href="URL"> tags as follows:
  - "home addition" or "home additions" → <a href="/services/home-additions">home addition</a>
  - "kitchen remodel" or "kitchen remodeling" → <a href="/services/kitchen-remodeling">kitchen remodeling</a>
  - "bathroom remodel" or "bathroom remodeling" → <a href="/services/bathroom-remodeling">bathroom remodeling</a>
  - "custom carpentry" → <a href="/services/custom-carpentry">custom carpentry</a>
  - "snow removal" → <a href="/services/snow-removal">snow removal</a>
  - "siding" or "siding installation" → <a href="/services/siding">siding</a>
  - "deck" or "deck construction" or "decks" → <a href="/services/decks-porches-pergolas">deck</a>
  - "pergola" or "porch" → <a href="/services/decks-porches-pergolas">pergola</a>
  - "free design preview" → <a href="/start">free design preview</a>
  - "free estimate" or "free quote" → <a href="/contact">free estimate</a>
  - "contact us" or "reach out" (only once at the end) → <a href="/contact">contact us</a>
- Use each hyperlink naturally — do not force them. 3-6 hyperlinks total is ideal.

CONTENT RULES:
- Target Greater Boston homeowners
- Be 600-900 words
- Include practical tips, Boston-area costs/pricing context, and local seasonal considerations
- End with a compelling call to action paragraph (not a heading) encouraging readers to get a free estimate or try the free design preview

Return JSON with these fields:
- title: A compelling, SEO-friendly title (include "Boston" or "Greater Boston" or "MA") — plain text only, no HTML, no markdown, no surrounding quotes
- excerpt: A 1-2 sentence plain text summary (150 chars max) — no HTML or markdown
- content: The full blog post body as valid, clean HTML (using ONLY the tags described above)
- read_time: Estimated read time (e.g. "6 min read")`;

const SETTINGS_KEY = "blog_ai_prompt";

// Password gate (reuses same admin password)
function PasswordGate({ onAuth }) {
  const [password, setPassword] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileReset, setTurnstileReset] = useState(0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const res = await base44.functions.invoke("validateBlogPassword", { password });
    if (res.data.valid) {
      onAuth();
    } else {
      alert("Incorrect password");
      setPassword("");
      setTurnstileReset((n) => n + 1);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-secondary to-secondary/95 flex items-center justify-center px-4">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-sm w-full">
        <h1 className="text-2xl font-bold text-secondary mb-2 text-center">Blog Admin</h1>
        <p className="text-gray-600 text-center text-sm mb-6">Enter password to access</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            autoFocus
          />
          <TurnstileWidget
            onVerify={setTurnstileToken}
            onExpire={() => setTurnstileToken("")}
            resetSignal={turnstileReset}
          />
          <button type="submit" disabled={!turnstileToken} className="w-full bg-primary text-white font-bold py-3 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-60">
            Unlock Dashboard
          </button>
        </form>
      </div>
    </div>
  );
}

// Edit/Create post modal
function PostModal({ post, onClose, onSave }) {
  // Normalize legacy markdown/plain-text posts to clean HTML for the editor
  const normalizeContent = (raw) => formatBlogContent(raw);

  const [form, setForm] = useState({
    title: post?.title || "",
    slug: post?.slug || "",
    category: post?.category || "General",
    tags: post?.tags || [],
    excerpt: post?.excerpt || "",
    content: normalizeContent(post?.content || ""),
    img: post?.img || "",
    read_time: post?.read_time || "5 min read",
    published: post?.published !== undefined ? post.published : true,
  });

  const [tagInput, setTagInput] = useState((post?.tags || []).join(", "));

  const slugify = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  const handleTitleChange = (val) => {
    setForm(f => ({ ...f, title: val, slug: post ? f.slug : slugify(val) }));
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-auto">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-secondary">{post ? "Edit Post" : "New Post"}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="overflow-y-auto p-6 space-y-4 flex-1">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Title *</label>
              <input
                value={form.title}
                onChange={e => handleTitleChange(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Slug *</label>
              <input
                value={form.slug}
                onChange={e => setForm(f => ({ ...f, slug: e.target.value }))}
                className="w-full bg-white border border-gray-200 rounded px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-primary font-mono"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Category</label>
              <input
                value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="w-full bg-white border border-gray-200 rounded px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-primary"
              />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Tags <span className="text-gray-400 font-normal normal-case">(comma-separated)</span></label>
              <input
                value={tagInput}
                onChange={e => {
                  setTagInput(e.target.value);
                  setForm(f => ({ ...f, tags: e.target.value.split(",").map(t => t.trim()).filter(Boolean) }));
                }}
                placeholder="e.g. home-addition, kitchen, boston, cost-guide"
                className="w-full bg-white border border-gray-200 rounded px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-primary"
              />
              {form.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {form.tags.map(tag => (
                    <span key={tag} className="bg-primary/10 text-primary text-xs font-semibold px-2 py-0.5 rounded-full">{tag}</span>
                  ))}
                </div>
              )}
            </div>
            <div className="col-span-2">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Excerpt</label>
              <textarea
                rows={2}
                value={form.excerpt}
                onChange={e => setForm(f => ({ ...f, excerpt: e.target.value }))}
                className="w-full bg-white border border-gray-200 rounded px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-primary resize-none"
              />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Content</label>
              <div className="border border-gray-200 rounded overflow-hidden">
                <ReactQuill
                  theme="snow"
                  value={form.content}
                  onChange={(val) => setForm(f => ({ ...f, content: val }))}
                  modules={{
                    toolbar: [
                      [{ header: [1, 2, 3, false] }],
                      ["bold", "italic", "underline", "strike"],
                      [{ list: "ordered" }, { list: "bullet" }],
                      ["link", "blockquote", "code-block"],
                      ["clean"],
                    ],
                  }}
                  style={{ minHeight: "280px" }}
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Hero Image URL</label>
              <input
                value={form.img}
                onChange={e => setForm(f => ({ ...f, img: e.target.value }))}
                className="w-full bg-white border border-gray-200 rounded px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Read Time</label>
              <input
                value={form.read_time}
                onChange={e => setForm(f => ({ ...f, read_time: e.target.value }))}
                className="w-full bg-white border border-gray-200 rounded px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-primary"
              />
            </div>
            <div className="col-span-2 flex items-center gap-2">
              <input
                type="checkbox"
                id="published"
                checked={form.published}
                onChange={e => setForm(f => ({ ...f, published: e.target.checked }))}
                className="w-4 h-4 accent-primary"
              />
              <label htmlFor="published" className="text-sm text-gray-700">Published</label>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
          <button
            onClick={() => onSave(form)}
            className="px-5 py-2 bg-primary text-white text-sm font-bold rounded hover:bg-primary/90 transition-colors flex items-center gap-2"
          >
            <Check className="w-4 h-4" /> Save Post
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminBlog({ embedded = false }) {
  const [authenticated, setAuthenticated] = useState(embedded);
  const [tab, setTab] = useState("posts"); // posts | generate | settings
  const [editPost, setEditPost] = useState(null); // null = closed, {} = new, post obj = edit
  const [generating, setGenerating] = useState(false);
  const [generateTopic, setGenerateTopic] = useState("");
  const [generateResult, setGenerateResult] = useState(null);
  const [generatingImageFor, setGeneratingImageFor] = useState(null); // post id
  const [promptValue, setPromptValue] = useState("");
  const [savingPrompt, setSavingPrompt] = useState(false);
  const [promptSaved, setPromptSaved] = useState(false);

  // Schedule state
  const [scheduleEnabled, setScheduleEnabled] = useState(true);
  const [scheduleDays, setScheduleDays] = useState([1, 4]); // Mon, Thu
  const [scheduleTime, setScheduleTime] = useState("09:00");
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [scheduleSaved, setScheduleSaved] = useState(false);

  const queryClient = useQueryClient();

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ["admin-blog-posts"],
    queryFn: () => base44.entities.BlogPost.list("-created_date", 100),
    enabled: authenticated,
  });

  const { data: settings = [] } = useQuery({
    queryKey: ["app-settings"],
    queryFn: () => base44.entities.AppSettings.filter({ key: SETTINGS_KEY }),
    enabled: authenticated,
    onSuccess: (data) => {
      if (data[0]?.value && !promptValue) setPromptValue(data[0].value);
    }
  });

  const { data: scheduleSettings = [] } = useQuery({
    queryKey: ["blog-schedule-settings"],
    queryFn: () => base44.entities.AppSettings.filter({ key: "blog_schedule_settings" }),
    enabled: authenticated,
  });

  useEffect(() => {
    if (scheduleSettings[0]?.value) {
      try {
        const parsed = JSON.parse(scheduleSettings[0].value);
        if (parsed.days !== undefined) setScheduleDays(parsed.days);
        if (parsed.time) setScheduleTime(parsed.time);
        if (parsed.enabled !== undefined) setScheduleEnabled(parsed.enabled);
      } catch {}
    }
  }, [scheduleSettings]);

  const currentPromptSetting = settings[0];

  // Initialize prompt from settings
  useState(() => {
    if (currentPromptSetting?.value) setPromptValue(currentPromptSetting.value);
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.BlogPost.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-blog-posts"] }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.BlogPost.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-blog-posts"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.BlogPost.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-blog-posts"] }),
  });

  const handleSavePost = async (form) => {
    if (editPost?.id) {
      await updateMutation.mutateAsync({ id: editPost.id, data: form });
    } else {
      await createMutation.mutateAsync(form);
    }
    setEditPost(null);
  };

  const handleDelete = async (post) => {
    if (!confirm(`Delete "${post.title}"?`)) return;
    await deleteMutation.mutateAsync(post.id);
  };

  const handleGenerateImage = async (post) => {
    setGeneratingImageFor(post.id);
    await base44.functions.invoke("generateBlogImages", { batchStart: 0, batchSize: 1, postId: post.id });
    queryClient.invalidateQueries({ queryKey: ["admin-blog-posts"] });
    setGeneratingImageFor(null);
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setGenerateResult(null);
    const res = await base44.functions.invoke("generateBlogPost", { topic: generateTopic || undefined });
    setGenerateResult(res.data);
    setGenerating(false);
    queryClient.invalidateQueries({ queryKey: ["admin-blog-posts"] });
  };

  const handleSavePrompt = async () => {
    setSavingPrompt(true);
    const val = promptValue || DEFAULT_PROMPT;
    if (currentPromptSetting?.id) {
      await base44.entities.AppSettings.update(currentPromptSetting.id, { value: val });
    } else {
      await base44.entities.AppSettings.create({ key: SETTINGS_KEY, value: val });
    }
    queryClient.invalidateQueries({ queryKey: ["app-settings"] });
    setSavingPrompt(false);
    setPromptSaved(true);
    setTimeout(() => setPromptSaved(false), 3000);
  };

  const handleSaveSchedule = async () => {
    if (scheduleDays.length === 0) return;
    setSavingSchedule(true);
    await base44.functions.invoke("updateBlogSchedule", {
      enabled: scheduleEnabled,
      days: scheduleDays,
      time: scheduleTime,
    });
    queryClient.invalidateQueries({ queryKey: ["blog-schedule-settings"] });
    setSavingSchedule(false);
    setScheduleSaved(true);
    setTimeout(() => setScheduleSaved(false), 4000);
  };

  const toggleDay = (day) => {
    setScheduleDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort()
    );
  };

  if (!authenticated && !embedded) return <PasswordGate onAuth={() => setAuthenticated(true)} />;

  const TABS = [
    { id: "posts", label: "Blog Posts", icon: BookOpen },
    { id: "generate", label: "Generate with AI", icon: Sparkles },
    { id: "schedule", label: "Auto-Schedule", icon: Calendar },
    { id: "settings", label: "AI Prompt Settings", icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      {!embedded && <div className="bg-secondary text-white px-6 py-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Blog Admin</h1>
          <p className="text-white/60 text-sm">Coen Construction — Manage blog content</p>
        </div>
        <div className="flex items-center gap-4">
          <a href="/blog" target="_blank" className="text-white/70 hover:text-white text-sm transition-colors">View Blog ↗</a>
          <a href="/" className="text-white/70 hover:text-white text-sm transition-colors">← Back to Site</a>
        </div>
      </div>}
      {embedded && <div className="px-6 pt-6 pb-0"><h1 className="text-2xl font-bold text-secondary">Blog Posts</h1></div>}

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 px-6 shadow-sm">
        <div className="flex gap-1">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-3.5 text-sm font-semibold border-b-2 transition-colors ${tab === t.id ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-gray-700"}`}
            >
              <t.icon className="w-4 h-4" />{t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-6 py-6 bg-gray-50 min-h-screen">

        {/* POSTS TAB */}
        {tab === "posts" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-500">{posts.length} posts total</p>
              <button
                onClick={() => setEditPost({})}
                className="bg-primary text-white text-sm font-bold px-4 py-2 rounded hover:bg-primary/90 transition-colors flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> New Post
              </button>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              {isLoading ? (
                <div className="py-16 text-center text-gray-400">Loading...</div>
              ) : posts.length === 0 ? (
                <div className="py-16 text-center text-gray-400">No posts yet</div>
              ) : (
                <table className="w-full">
                <thead className="bg-secondary/5 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Title</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wider hidden md:table-cell">Category / Tags</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wider hidden md:table-cell">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Image</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {posts.map(post => (
                    <tr key={post.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-secondary text-sm">{post.title}</div>
                        <div className="text-xs text-gray-400 font-mono">/blog/{post.slug}</div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                         <div className="text-sm text-gray-600">{post.category || "—"}</div>
                         {post.tags?.length > 0 && (
                           <div className="flex flex-wrap gap-1 mt-1">
                             {post.tags.map(tag => (
                               <span key={tag} className="bg-primary/10 text-primary text-xs font-medium px-1.5 py-0.5 rounded-full">{tag}</span>
                             ))}
                           </div>
                         )}
                       </td>
                      <td className="px-4 py-3 text-sm text-gray-400 hidden md:table-cell">
                        {post.created_date ? format(new Date(post.created_date), "MMM d, yyyy") : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded ${post.published !== false ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                          {post.published !== false ? "Published" : "Draft"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {post.img && (
                            <img src={post.img} alt="" className="w-10 h-7 object-cover rounded border border-gray-200" />
                          )}
                          <button
                            onClick={() => handleGenerateImage(post)}
                            disabled={generatingImageFor === post.id}
                            title={post.img ? "Regenerate image" : "Generate image"}
                            className="text-gray-400 hover:text-primary transition-colors disabled:opacity-40"
                          >
                            {generatingImageFor === post.id
                              ? <RefreshCw className="w-4 h-4 animate-spin" />
                              : <Image className="w-4 h-4" />}
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 justify-end">
                          <button onClick={() => setEditPost(post)} className="text-gray-400 hover:text-primary transition-colors">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDelete(post)} className="text-gray-400 hover:text-red-500 transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* GENERATE TAB */}
        {tab === "generate" && (
          <div className="max-w-2xl">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-bold text-secondary mb-1">Generate Blog Post with AI</h2>
              <p className="text-sm text-gray-500 mb-5">Optionally specify a topic, or leave blank for a random one. The AI will write and publish a complete post.</p>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Topic (optional)</label>
                  <input
                    value={generateTopic}
                    onChange={e => setGenerateTopic(e.target.value)}
                    placeholder="e.g. Storm Damage Repair in Boston"
                    className="w-full bg-white border border-gray-200 rounded px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:border-primary"
                  />
                </div>
                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  className="w-full bg-primary text-white font-bold py-3 rounded hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {generating ? (
                    <><RefreshCw className="w-4 h-4 animate-spin" /> Generating (this takes ~30 seconds)...</>
                  ) : (
                    <><Sparkles className="w-4 h-4" /> Generate & Publish Post</>
                  )}
                </button>
              </div>
              {generateResult && (
                <div className="mt-5 p-4 bg-green-50 rounded-lg border border-green-100">
                  <div className="flex items-center gap-2 text-green-700 font-semibold text-sm mb-1">
                    <Check className="w-4 h-4" /> Post published successfully!
                  </div>
                  <div className="text-sm text-gray-600">{generateResult.post?.title}</div>
                  <a
                    href={`/blog/${generateResult.post?.slug}`}
                    target="_blank"
                    className="text-primary text-xs hover:underline mt-1 inline-block"
                  >
                    View post →
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

        {/* SCHEDULE TAB */}
        {tab === "schedule" && (
          <div className="max-w-2xl space-y-6">
            {/* Enable/Disable */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-secondary">Auto Blog Post Scheduler</h2>
                  <p className="text-sm text-gray-500 mt-0.5">AI will automatically write and publish a blog post on the selected days.</p>
                </div>
                <button
                  onClick={() => setScheduleEnabled(e => !e)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-colors ${scheduleEnabled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}
                >
                  <Power className="w-4 h-4" />
                  {scheduleEnabled ? "Enabled" : "Disabled"}
                </button>
              </div>

              {/* Day Picker */}
              <div className="mb-5">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-3">
                  <Calendar className="w-3.5 h-3.5 inline mr-1" /> Post on These Days
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: "Sun", val: 0 },
                    { label: "Mon", val: 1 },
                    { label: "Tue", val: 2 },
                    { label: "Wed", val: 3 },
                    { label: "Thu", val: 4 },
                    { label: "Fri", val: 5 },
                    { label: "Sat", val: 6 },
                  ].map(d => (
                    <button
                      key={d.val}
                      onClick={() => toggleDay(d.val)}
                      className={`w-14 py-2.5 rounded-lg text-sm font-bold transition-colors border-2 ${
                        scheduleDays.includes(d.val)
                          ? "bg-primary text-white border-primary"
                          : "bg-white text-gray-500 border-gray-200 hover:border-primary/40"
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
                {scheduleDays.length === 0 && (
                  <p className="text-xs text-red-500 mt-2">Select at least one day.</p>
                )}
              </div>

              {/* Time Picker */}
              <div className="mb-6">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-2">
                  <Clock className="w-3.5 h-3.5 inline mr-1" /> Time of Day (Eastern Time)
                </label>
                <input
                  type="time"
                  value={scheduleTime}
                  onChange={e => setScheduleTime(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary"
                />
                <p className="text-xs text-gray-400 mt-1">All times are in Eastern Time (ET).</p>
              </div>

              {/* Summary */}
              <div className="bg-muted rounded-lg p-4 mb-5 text-sm text-gray-600">
                <strong className="text-secondary">Current schedule:</strong>{" "}
                {scheduleDays.length === 0
                  ? "No days selected."
                  : `Posts will be auto-generated every ${["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].filter((_, i) => scheduleDays.includes(i)).join(", ")} at ${scheduleTime} ET.`
                }{" "}
                {!scheduleEnabled && <span className="text-red-500 font-semibold">(Scheduler is currently disabled)</span>}
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleSaveSchedule}
                  disabled={savingSchedule || scheduleDays.length === 0}
                  className="flex items-center gap-2 bg-primary text-white font-bold px-5 py-2.5 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-60 text-sm"
                >
                  {savingSchedule ? <><RefreshCw className="w-4 h-4 animate-spin" /> Saving...</> : <><Check className="w-4 h-4" /> Save Schedule</>}
                </button>
                {scheduleSaved && <span className="text-green-600 text-sm font-semibold">✓ Schedule saved!</span>}
              </div>
            </div>

            {/* Info box */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700">
              <strong>How it works:</strong> On each scheduled day, the AI will pick a random topic (or use a topic from the list), write a full blog post, generate a hero image, and publish it automatically to your blog. You can customize the AI prompt in the <button onClick={() => setTab("settings")} className="underline font-semibold">AI Prompt Settings</button> tab.
            </div>
          </div>
        )}

        {/* SETTINGS TAB */}
        {tab === "settings" && (
          <div className="max-w-3xl">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-bold text-secondary mb-1">AI Blog Generation Prompt</h2>
              <p className="text-sm text-gray-500 mb-4">
                Customize the instructions the AI receives when generating blog posts. Use <code className="bg-muted px-1 rounded text-xs">{"{topic}"}</code> as a placeholder for the post topic.
              </p>
              <textarea
                rows={20}
                value={promptValue || (currentPromptSetting?.value ?? DEFAULT_PROMPT)}
                onChange={e => setPromptValue(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded px-3 py-3 text-sm text-gray-800 focus:outline-none focus:border-primary resize-none font-mono leading-relaxed"
              />
              <div className="flex items-center gap-3 mt-3">
                <button
                  onClick={handleSavePrompt}
                  disabled={savingPrompt}
                  className="bg-primary text-white text-sm font-bold px-5 py-2.5 rounded hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center gap-2"
                >
                  {savingPrompt ? <><RefreshCw className="w-4 h-4 animate-spin" /> Saving...</> : <><Check className="w-4 h-4" /> Save Prompt</>}
                </button>
                {promptSaved && <span className="text-green-600 text-sm font-medium">Saved!</span>}
                <button
                  onClick={() => setPromptValue(DEFAULT_PROMPT)}
                  className="text-sm text-gray-500 hover:text-gray-700 underline"
                >
                  Reset to default
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {editPost !== null && (
        <PostModal
          post={editPost?.id ? editPost : null}
          onClose={() => setEditPost(null)}
          onSave={handleSavePost}
        />
      )}
    </div>
  );
}