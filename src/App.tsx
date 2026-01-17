
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  LayoutDashboard, 
  PawPrint, 
  Users, 
  MessageCircle, 
  Lightbulb, 
  Plus, 
  Trash2, 
  Edit3, 
  Send,
  Heart, 
  MessageSquare,
  FileText,
  X,
  Upload,
  ChevronRight,
  ChevronDown,
  RotateCw,
  Settings,
  LogOut,
  Mail,
  ToggleLeft,
  ToggleRight,
  AlertTriangle,
  CheckCircle2,
  Stethoscope, 
  ChevronLeft,
  History,
  Activity,
  Filter,
  FileIcon,
  Video,
  ImageIcon,
  FileUp,
  Loader2,
  Info,
  Layers, 
  User,
  Search,
  BookOpen,
  FilePenLine // Added for AI Post Enhancement button
} from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react'; 
import { Pet, PetType, Post, PostType, Tip, ChatMessage, Comment, MedicalRecord } from './types';
import { getChatResponse, generatePetReport, getDailyTips, getPetHealthScore, summarizeCommunityReplies, enhanceCommunityPost, summarizeSinglePost } from './services/geminiService';
// NEW: Import Google Apps Script backend service
import * as googleAppsScriptService from './services/googleAppsScriptService';

// Mapping PostType to Lucide icons for consistent UI
const POST_TYPE_ICONS = {
  [PostType.UPDATE]: Layers,
  [PostType.QUESTION]: MessageSquare,
  [PostType.CARE_TIPS]: Lightbulb,
  [PostType.HEALTH]: Stethoscope,
  // [PostType.STORIES]: Heart, Removed
};

// --- Utility: Enhanced Markdown Formatter ---
const FormattedText = ({ text }: { text: string }) => {
  if (!text) return null;
  const lines = text.split('\n');
  const renderInline = (lineContent: string) => {
    const parts = lineContent.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, pIdx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={pIdx} className="font-extrabold text-indigo-700">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return part;
    });
  };
  return (
    <div className="space-y-3">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (trimmed === '') return <div key={idx} className="h-2" />;
        const headerMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
        if (headerMatch) {
          const level = headerMatch[1].length;
          const content = headerMatch[2];
          const headerClasses = 
            level === 1 ? "text-2xl font-black mt-6 mb-4 text-gray-900" :
            level === 2 ? "text-xl font-black mt-5 mb-3 text-gray-900" :
            "text-lg font-black mt-4 mb-2 text-indigo-800 uppercase tracking-tight";
          return <h4 key={idx} className={headerClasses}>{renderInline(content)}</h4>;
        }
        const listMatch = trimmed.match(/^(\*|-|\d+\.)\s+(.*)$/);
        if (listMatch) {
          return (
            <div key={idx} className="flex space-x-3 ml-2 mb-1 group">
              <span className="font-black text-indigo-500 mt-0.5">•</span>
              <span className="flex-1 text-gray-800 leading-relaxed">{renderInline(listMatch[2])}</span>
            </div>
          );
        }
        return <p key={idx} className="leading-relaxed text-gray-800">{renderInline(line)}</p>;
      })}
    </div>
  );
};

const SidebarItem = ({ icon: Icon, label, active, onClick }: any) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${
      active 
        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' 
        : 'text-gray-600 hover:bg-gray-100'
    }`}
  >
    <Icon size={20} />
    <span className="font-semibold">{label}</span>
  </button>
);

const App: React.FC = () => {
  // Navigation & View State
  const [activeTab, setActiveTab] = useState<'dashboard' | 'pets' | 'community' | 'chat' | 'tips' | 'pet-profile'>('dashboard');
  const [profileSource, setProfileSource] = useState<'dashboard' | 'pets'>('dashboard');
  // const [isProfilesListView, setIsProfilesListView] = useState(false); // Removed, only grid view now
  
  // Data State
  const [pets, setPets] = useState<Pet[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [dailyTips, setDailyTips] = useState<Tip[]>([]);
  
  // Modals & UI Toggles
  const [isAddPetModalOpen, setIsAddPetModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalFromApp] = useState(false); // Renamed to avoid clash with local function
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false); // For deleting a pet
  const [isDeleteRecordModalOpen, setIsDeleteRecordModalOpen] = useState(false); // For deleting a medical record
  const [isAnalysisPickerOpen, setIsAnalysisPickerOpen] = useState(false);
  const [isTipsLoading, setIsTipsLoading] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState<string | null>(null);

  // Active Context State
  const [editingPet, setEditingPet] = useState<Pet | null>(null);
  const [petToDelete, setPetToDelete] = useState<Pet | null>(null); // For pet deletion
  const [recordToDelete, setRecordToDelete] = useState<MedicalRecord | null>(null); // For record deletion
  const [selectedPetForAnalysis, setSelectedPetForAnalysis] = useState<Pet | null>(null);
  const [viewingPetId, setViewingPetId] = useState<string | null>(null);
  const [qrPet, setQrPet] = useState<Pet | null>(null); 
  
  // Chat State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  
  // Community State
  const [newPostContent, setNewPostContent] = useState('');
  const [newPostType, setNewPostType] = useState<PostType>(PostType.UPDATE); // For composing new posts
  const [activeCommentPostId, setActiveCommentPostId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const replyInputRef = useRef<HTMLInputElement>(null);
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false); // New state for summary modal
  const [currentSummaryContent, setCurrentSummaryContent] = useState<string | null>(null); // New state for summary content
  const [isSummaryLoading, setIsSummaryLoading] = useState(false); // New state for summary loading
  const [currentSummaryType, setCurrentSummaryType] = useState<'post' | 'replies' | null>(null); // New: to distinguish between post/reply summaries


  // New Post Enhancement State
  const [isEnhancePostModalOpen, setIsEnhancePostModalOpen] = useState(false);
  const [postToEnhanceContent, setPostToEnhanceContent] = useState<string>('');
  const [postToEnhanceType, setPostToEnhanceType] = useState<PostType>(PostType.UPDATE);
  const [editingPostForEnhancementId, setEditingPostForEnhancementId] = useState<string | null>(null); // Null for new post, ID for existing
  const [enhancedPostTitle, setEnhancedPostTitle] = useState<string | null>(null);
  const [enhancedPostContent, setEnhancedPostContent] = useState<string | null>(null);
  const [isEnhancingPost, setIsEnhancingPost] = useState(false);


  // Community Feed Search & Sort
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'most-commented' | 'most-liked'>('newest');
  const [isCommunitySortOpen, setIsCommunitySortOpen] = useState(false);
  const communitySortRef = useRef<HTMLDivElement>(null);
  const communitySearchRef = useRef<HTMLDivElement>(null);

  // Community Feed Post Type Filter
  const [activePostFilterCategory, setActivePostFilterCategory] = useState<'ALL' | PostType>('ALL'); // For filtering displayed posts


  // Debounce search term for Community Feed
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => {
      clearTimeout(handler);
    };
  }, [searchTerm]);

  // Handle outside click for Community Sort dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (communitySortRef.current && !communitySortRef.current.contains(event.target as Node)) {
        setIsCommunitySortOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);


  // Tips Hub Filtering
  const [selectedTipCategory, setSelectedTipCategory] = useState<string | null>(null);
  const [isTipFilterOpen, setIsTipFilterOpen] = useState(false);
  const tipFilterRef = useRef<HTMLDivElement>(null);

  // Medical Record State
  const [isAddRecordModalOpen, setIsAddRecordModalOpen] = useState(false);
  const [isRecordUploading, setIsRecordUploading] = useState(false);
  const [recordFile, setRecordFile] = useState<File | null>(null);
  const [recordDescription, setRecordDescription] = useState('');
  const [recordError, setRecordError] = useState<string | null>(null);
  const recordFileInputRef = useRef<HTMLInputElement>(null);

  // User Profile State (New and updated based on requirements)
  const [userId, setUserId] = useState<string>(''); // NEW: Unique User ID
  const [username, setUsername] = useState<string>(''); // NEW: Required Username
  const [displayName, setDisplayName] = useState<string>(''); // Renamed from userName
  const [userEmail, setUserEmail] = useState<string>(''); // Optional Email
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  // Settings form state to track changes and initial values for "Save Changes" button logic
  const [initialSettings, setInitialSettings] = useState({
    username: '',
    displayName: '',
    userEmail: '',
    notificationsEnabled: true,
  });
  const [settingsForm, setSettingsForm] = useState({
    username: '',
    displayName: '',
    userEmail: '',
    notificationsEnabled: true,
  });

  const [usernameError, setUsernameError] = useState<string | null>(null);

  // Form handling
  const [isSyncing, setIsSyncing] = useState(false);
  const [petForm, setPetForm] = useState({
    name: '', breed: '', age: '', weight: '', emergencyContact: '', type: PetType.DOG, imageUrl: ''
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const ageInputRef = useRef<HTMLInputElement>(null);
  const weightInputRef = useRef<HTMLInputElement>(null);
  const phoneInputRef = useRef<HTMLInputElement>(null);

  // Date and Day State
  const [currentDay, setCurrentDay] = useState('');
  const [currentDateFormatted, setCurrentDateFormatted] = useState('');

  // --- Persistence & Initial Load ---
  useEffect(() => {
    // Load existing user data or initialize new
    let loadedUserId = localStorage.getItem('paw_userId');
    if (!loadedUserId) {
      // Generate new User ID if not found (first launch)
      loadedUserId = crypto.randomUUID();
      localStorage.setItem('paw_userId', loadedUserId);
    }
    setUserId(loadedUserId);

    const loadedUsername = localStorage.getItem('paw_username') || '';
    const loadedDisplayName = localStorage.getItem('paw_displayName') || '';
    const loadedUserEmail = localStorage.getItem('paw_userEmail') || '';
    const loadedNotificationsEnabled = localStorage.getItem('paw_notificationsEnabled') === 'true';

    setDisplayName(loadedDisplayName);
    setUsername(loadedUsername);
    setUserEmail(loadedUserEmail);
    setNotificationsEnabled(loadedNotificationsEnabled);

    // Set initial settings for change detection
    setInitialSettings({
      username: loadedUsername,
      displayName: loadedDisplayName,
      userEmail: loadedUserEmail,
      notificationsEnabled: loadedNotificationsEnabled,
    });
    setSettingsForm({
      username: loadedUsername,
      displayName: loadedDisplayName,
      userEmail: loadedUserEmail,
      notificationsEnabled: loadedNotificationsEnabled,
    });


    const savedPets = localStorage.getItem('paw_pets');
    const savedPosts = localStorage.getItem('paw_posts');
    if (savedPets) setPets(JSON.parse(savedPets)); // Corrected bug here
    if (savedPosts) setPosts(JSON.parse(savedPosts));
    refreshTips();

    // Set current day and date
    const today = new Date();
    setCurrentDay(new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(today));
    setCurrentDateFormatted(new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'short', year: 'numeric' }).format(today));
  }, []); // Run only once on mount

  useEffect(() => { localStorage.setItem('paw_pets', JSON.stringify(pets)); }, [pets]);
  useEffect(() => { localStorage.setItem('paw_posts', JSON.stringify(posts)); }, [posts]);

  useEffect(() => {
    if (showSuccessToast) {
      const timer = setTimeout(() => setShowSuccessToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [showSuccessToast]);

  // Handle outside click for filter dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tipFilterRef.current && !tipFilterRef.current.contains(event.target as Node)) {
        setIsTipFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);


  // --- Logic Handlers ---

  // Settings Logic
  const validateUsername = (name: string): string | null => {
    if (!name.trim()) return "Username is required.";
    if (!/^[a-z0-9_]{3,20}$/.test(name)) {
      return "3-20 lowercase letters, numbers, or underscores only.";
    }
    return null;
  };

  const handleSettingsChange = (field: string, value: any) => {
    setSettingsForm(prev => ({ ...prev, [field]: value }));
    if (field === 'username') {
      setUsernameError(validateUsername(value));
    }
  };

  const hasSettingsChanged = useMemo(() => {
    return (
      settingsForm.username !== initialSettings.username ||
      settingsForm.displayName !== initialSettings.displayName ||
      settingsForm.userEmail !== initialSettings.userEmail ||
      settingsForm.notificationsEnabled !== initialSettings.notificationsEnabled
    );
  }, [settingsForm, initialSettings]);

  const canSaveSettings = useMemo(() => {
    return hasSettingsChanged && !usernameError && settingsForm.username.trim() !== '';
  }, [hasSettingsChanged, usernameError, settingsForm.username]);

  const handleSaveChanges = () => {
    const usernameValidation = validateUsername(settingsForm.username);
    if (usernameValidation) {
      setUsernameError(usernameValidation);
      return;
    }

    localStorage.setItem('paw_username', settingsForm.username);
    localStorage.setItem('paw_displayName', settingsForm.displayName);
    localStorage.setItem('paw_userEmail', settingsForm.userEmail);
    localStorage.setItem('paw_notificationsEnabled', String(settingsForm.notificationsEnabled));

    setUsername(settingsForm.username);
    setDisplayName(settingsForm.displayName);
    setUserEmail(settingsForm.userEmail);
    setNotificationsEnabled(settingsForm.notificationsEnabled);

    // Update initial settings to match saved values
    setInitialSettings({ ...settingsForm });
    setIsSettingsModalFromApp(false);
    setShowSuccessToast("Settings saved!");
  };

  const handleSignOut = () => {
    localStorage.removeItem('paw_userId');
    localStorage.removeItem('paw_username');
    localStorage.removeItem('paw_displayName');
    localStorage.removeItem('paw_userEmail');
    localStorage.removeItem('paw_notificationsEnabled');
    localStorage.removeItem('paw_pets'); // Clear all user-related data
    localStorage.removeItem('paw_posts'); // Clear all user-related data
    window.location.reload(); // Simulate a fresh install
  };

  const refreshTips = async () => {
    setSelectedTipCategory(null); // Reset category filter on refresh
    setIsTipsLoading(true);
    try {
      const tips = await getDailyTips(40); // Changed from 15 to 40
      setDailyTips(tips);
    } catch (e) { console.error(e); } finally { setIsTipsLoading(false); }
  };

  const handleAddPet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validatePetForm()) return;
    setIsSyncing(true);
    
    const petId = editingPet?.id || Math.random().toString(36).substr(2, 9);
    const initialPetData = {
      ...petForm,
      age: parseInt(petForm.age),
      weight: parseFloat(petForm.weight),
    };

    let updatedPet: Pet;
    if (editingPet) {
      updatedPet = { ...editingPet, ...initialPetData } as Pet;
      setPets(prev => prev.map(p => p.id === petId ? updatedPet : p));
    } else {
      updatedPet = {
        ...initialPetData,
        id: petId,
        createdAt: new Date().toISOString(),
        healthScore: 85,
        records: []
      } as Pet;
      setPets(prev => [...prev, updatedPet]);
    }

    setTimeout(() => {
      setIsAddPetModalOpen(false);
      resetPetForm();
      setIsSyncing(false);
      setShowSuccessToast(editingPet ? `${initialPetData.name} updated!` : `${initialPetData.name} registered!`);
      setEditingPet(null);
    }, 200);

    const hScore = await getPetHealthScore(updatedPet);
    setPets(prev => prev.map(p => p.id === petId ? { ...p, healthScore: hScore } : p));
  };

  const validatePetForm = () => {
    const errors: Record<string, string> = {};
    if (!petForm.name.trim()) errors.name = "Required";
    if (!petForm.age) errors.age = "Required";
    if (!petForm.weight) errors.weight = "Required";
    if (petForm.emergencyContact.length !== 10) errors.emergencyContact = "Need 10 digits";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const resetPetForm = () => {
    setPetForm({ name: '', breed: '', age: '', weight: '', emergencyContact: '', type: PetType.DOG, imageUrl: '' });
    setFormErrors({});
  };

  const openEditModal = (pet: Pet) => {
    setEditingPet(pet);
    setPetForm({
      name: pet.name, breed: pet.breed, age: pet.age.toString(), weight: pet.weight.toString(),
      emergencyContact: pet.emergencyContact, type: pet.type, imageUrl: pet.imageUrl || ''
    });
    setIsAddPetModalOpen(true);
  };

  const executeDeletePet = () => {
    if (!petToDelete) return;
    setPets(prev => prev.filter(p => p.id !== petToDelete.id));
    setIsDeleteModalOpen(false);
    setPetToDelete(null);
    setShowSuccessToast("Pet record deleted.");
  };

  const navigateToPetProfile = (petId: string, source: 'dashboard' | 'pets') => {
    setViewingPetId(petId);
    setProfileSource(source);
    setActiveTab('pet-profile');
  };

  // Community Feed Logic
  /**
   * Refreshes the posts from the backend and updates local state.
   * Initializes `likedByMe` to false for all fetched posts.
   */
  const refreshPosts = async () => {
    try {
      const fetchedPosts = await googleAppsScriptService.getPosts();
      // Ensure comments also have a 'createdAt' if not provided by backend.
      // And map backend format to frontend Post interface
      const mappedPosts: Post[] = fetchedPosts.map((p: any) => ({
        id: p.id,
        author: p.author, // Backend author will be the username
        type: p.type.charAt(0).toUpperCase() + p.type.slice(1).replace(/_/g, ' '), // Convert 'care_tips' to 'Care & Tips'
        content: p.content,
        likes: p.likes,
        likedByMe: false, // Client-side state, not fetched from backend directly
        comments: p.comments.map((c: any) => ({
          id: c.id,
          author: c.author,
          content: c.content,
          createdAt: c.createdAt || new Date().toISOString(), // Fallback if backend doesn't provide
        })),
        createdAt: p.createdAt,
      }));
      setPosts(mappedPosts);
    } catch (error) {
      console.error("Failed to refresh posts from backend:", error);
      setShowSuccessToast("Failed to load community feed.");
      // Optionally, fall back to local storage if backend is unavailable
      // const savedPosts = localStorage.getItem('paw_posts');
      // if (savedPosts) setPosts(JSON.parse(savedPosts));
    }
  };

  // NEW: Initial load for community posts from backend
  useEffect(() => {
    refreshPosts();
    // Also load other local storage items
    const savedPets = localStorage.getItem('paw_pets');
    if (savedPets) setPets(JSON.parse(savedPets));
    refreshTips(); // Load tips
    
    // Set current day and date (existing logic)
    const today = new Date();
    setCurrentDay(new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(today));
    setCurrentDateFormatted(new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'short', year: 'numeric' }).format(today));
  }, []); // Run only once on mount for initial data fetch


  const createPost = async () => {
    if (!newPostContent.trim()) return;
    if (!username) { // Ensure username is set before posting
      setShowSuccessToast("Please set your username in settings before posting.");
      return;
    }
    try {
      // Backend expects type in lowercase and with underscores for spaces (e.g., 'care_tips')
      await googleAppsScriptService.createPost(newPostContent, newPostType);
      setNewPostContent('');
      setShowSuccessToast("Update shared with community!");
      await refreshPosts(); // Refresh posts from backend after creation
    } catch (error) {
      console.error("Failed to create post:", error);
      setShowSuccessToast("Failed to share update. Please check your network and settings.");
    }
  };

  const likePost = async (postId: string) => {
    if (!username) {
      setShowSuccessToast("Please set your username in settings to like posts.");
      return;
    }
    try {
      // The backend handles the toggling of the like status.
      await googleAppsScriptService.likePost(postId);
      await refreshPosts(); // Refresh posts to reflect new like count and status
    } catch (error) {
      console.error("Failed to like post:", error);
      setShowSuccessToast("Failed to like post. Please try again.");
    }
  };

  const addComment = async (postId: string) => {
    if (!replyText.trim()) return;
    if (!username) {
      setShowSuccessToast("Please set your username in settings to add comments.");
      return;
    }
    try {
      await googleAppsScriptService.addComment(postId, replyText);
      setReplyText('');
      setActiveCommentPostId(null);
      setShowSuccessToast("Comment added!");
      await refreshPosts(); // Refresh posts to show the new comment
    } catch (error) {
      console.error("Failed to add comment:", error);
      setShowSuccessToast("Failed to add comment. Please try again.");
    }
  };

  const handleSummarizeReplies = async (postId: string) => {
    const post = posts.find(p => p.id === postId);
    if (!post || post.comments.length === 0) {
      setCurrentSummaryContent("There are no replies to summarize for this post yet.");
      setCurrentSummaryType('replies'); // Set type for modal title
      setIsSummaryModalOpen(true);
      return;
    }

    setIsSummaryLoading(true);
    setCurrentSummaryContent(null); // Clear previous summary
    setCurrentSummaryType('replies'); // Set type for modal title
    try {
      const commentContents = post.comments.map(c => c.content);
      const summary = await summarizeCommunityReplies(commentContents);
      setCurrentSummaryContent(summary);
    } catch (e) {
      console.error("Error summarizing replies:", e);
      setCurrentSummaryContent("Failed to generate summary. Please try again later.");
    } finally {
      setIsSummaryModalOpen(true);
      setIsSummaryLoading(false);
    }
  };

  const handleSummarizePostContent = async (postContent: string, postType: PostType) => {
    if (!postContent.trim()) {
      setCurrentSummaryContent("The post content is empty and cannot be summarized.");
      setCurrentSummaryType('post'); // Set type for modal title
      setIsSummaryModalOpen(true);
      return;
    }

    setIsSummaryLoading(true);
    setCurrentSummaryContent(null); // Clear previous summary
    setCurrentSummaryType('post'); // Set type for modal title
    try {
      const summary = await summarizeSinglePost(postContent, postType);
      setCurrentSummaryContent(summary);
    } catch (e) {
      console.error("Error summarizing post content:", e);
      setCurrentSummaryContent("Failed to generate post summary. Please try again later.");
    } finally {
      setIsSummaryModalOpen(true);
      setIsSummaryLoading(false);
    }
  };


  const handleEnhancePostClick = (originalContent: string, originalType: PostType, postId: string | null = null) => {
    setPostToEnhanceContent(originalContent);
    setPostToEnhanceType(originalType);
    setEditingPostForEnhancementId(postId);
    setEnhancedPostTitle(null);
    setEnhancedPostContent(null);
    setIsEnhancePostModalOpen(true);
  };

  const handleGenerateEnhancement = async () => {
    if (!postToEnhanceContent.trim()) {
      setEnhancedPostContent("Please enter some content to enhance.");
      return;
    }
    setIsEnhancingPost(true);
    setEnhancedPostTitle(null);
    setEnhancedPostContent(null);
    try {
      const { title, improvedPost } = await enhanceCommunityPost(postToEnhanceContent, postToEnhanceType);
      setEnhancedPostTitle(title);
      setEnhancedPostContent(improvedPost);
    } catch (e) {
      console.error("Error generating post enhancement:", e);
      setEnhancedPostContent("Failed to enhance post. Please try again later.");
      setEnhancedPostTitle("Enhancement Failed");
    } finally {
      setIsEnhancingPost(false);
    }
  };

  const handleUseEnhancedPost = () => {
    if (enhancedPostContent) {
      if (editingPostForEnhancementId) {
        // Update existing post
        setPosts(prev => prev.map(p => 
          p.id === editingPostForEnhancementId 
            ? { ...p, content: enhancedPostContent } 
            : p
        ));
        setShowSuccessToast("Post updated with AI enhancement!");
        // No need to refreshPosts here as this is a local edit based on an AI suggestion,
        // the original post was not sent to backend for "enhancement" directly.
        // If this were a direct backend update, refreshPosts would be needed.
      } else {
        // Update new post composer
        setNewPostContent(enhancedPostContent);
        // If a title was suggested, we might also want to inform the user or use it somehow
        // For now, just setting the content.
        setShowSuccessToast("New post enhanced with AI suggestion!");
      }
    }
    setIsEnhancePostModalOpen(false);
  };

  // Assistant & Medical logic
  const sendMessage = async () => {
    if (!chatInput.trim()) return;
    const userMsg: ChatMessage = { role: 'user', text: chatInput };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setIsChatLoading(true);
    try {
      const resp = await getChatResponse(chatMessages.map(m => ({ role: m.role, parts: [{ text: m.text }] })), chatInput);
      setChatMessages(prev => [...prev, { role: 'model', text: resp }]);
    } catch (e) { console.error(e); } finally { setIsChatLoading(false); }
  };

  const generateReportForPet = async (pet: Pet) => {
    setIsAnalysisPickerOpen(false);
    setActiveTab('chat');
    setIsChatLoading(true);
    setChatMessages([
      { role: 'model', text: `Initializing analysis for **${pet.name}**... Transposing health data to Paw Connect systems.` },
      { role: 'user', text: `Analyze health for my ${pet.age} year old ${pet.breed} (${pet.type}), who weighs ${pet.weight}kg.` }
    ]);
    try {
      const report = await generatePetReport(pet);
      setChatMessages(prev => [...prev, { role: 'model', text: report }]);
    } catch (err) {
      setChatMessages(prev => [...prev, { role: 'model', text: "Analysis failed. Please check your connectivity." }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleAddMedicalReport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recordFile || !viewingPetId) return;
    setIsRecordUploading(true);
    const reader = new FileReader();
    reader.onloadend = () => {
      const record: MedicalRecord = {
        id: Date.now().toString(),
        petId: viewingPetId,
        fileName: recordFile.name,
        fileType: recordFile.type.includes('pdf') ? 'pdf' : recordFile.type.includes('video') ? 'video' : 'image',
        fileUrl: reader.result as string,
        description: recordDescription,
        timestamp: new Date().toISOString()
      };
      setPets(prev => prev.map(p => p.id === viewingPetId ? { ...p, records: [record, ...(p.records || [])] } : p));
      setIsAddRecordModalOpen(false);
      setRecordFile(null);
      setRecordDescription('');
      setIsRecordUploading(false);
      setShowSuccessToast("Medical log updated.");
    };
    reader.readAsDataURL(recordFile);
  };

  const handleViewReport = (record: MedicalRecord) => {
    const parts = record.fileUrl.split(',');
    const blob = new Blob([Uint8Array.from(atob(parts[1]), c => c.charCodeAt(0))], { type: record.fileUrl.match(/:(.*?);/)?.[1] });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  const handleDeleteRecord = (record: MedicalRecord) => {
    setRecordToDelete(record);
    setIsDeleteRecordModalOpen(true);
  };

  const executeDeleteRecord = () => {
    if (!recordToDelete || !viewingPetId) return;

    setPets(prevPets => prevPets.map(pet => {
      if (pet.id === viewingPetId) {
        return {
          ...pet,
          records: pet.records?.filter(r => r.id !== recordToDelete.id)
        };
      }
      return pet;
    }));

    setIsDeleteRecordModalOpen(false);
    setRecordToDelete(null);
    setShowSuccessToast("Medical report deleted.");
  };

  // Profile data
  const currentViewingPet = pets.find(p => p.id === viewingPetId);
  const trainingTips = dailyTips.filter(t => t.category === 'Training' || t.title.toLowerCase().includes('train'));
  
  const filteredTips = dailyTips.filter(tip => !selectedTipCategory || tip.category === selectedTipCategory);

  const sortedPosts = useMemo(() => {
    let tempPosts = [...posts];

    // Apply category filter FIRST
    if (activePostFilterCategory !== 'ALL') {
      tempPosts = tempPosts.filter(post => post.type === activePostFilterCategory);
    }

    // Apply search filter
    if (debouncedSearchTerm) {
      const lowerCaseSearch = debouncedSearchTerm.toLowerCase();
      tempPosts = tempPosts.filter(post =>
        post.content.toLowerCase().includes(lowerCaseSearch) ||
        post.author.toLowerCase().includes(lowerCaseSearch)
      );
    }

    // Apply sort order
    switch (sortOrder) {
      case 'newest':
        tempPosts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      case 'oldest':
        tempPosts.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        break;
      case 'most-commented':
        tempPosts.sort((a, b) => b.comments.length - a.comments.length);
        break;
      case 'most-liked':
        tempPosts.sort((a, b) => b.likes - a.likes);
        break;
      default:
        break;
    }
    return tempPosts;
  }, [posts, activePostFilterCategory, debouncedSearchTerm, sortOrder]);


  return (
    <div id="main-app" className="h-screen flex bg-gray-50 text-gray-900 overflow-hidden">
      {/* Toast */}
      {showSuccessToast && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[200] animate-in slide-in-from-bottom-5">
           <div className="bg-emerald-600 text-white px-8 py-4 rounded-[30px] shadow-2xl flex items-center space-x-3 font-black">
              <CheckCircle2 size={24} />
              <span>{showSuccessToast}</span>
           </div>
        </div>
      )}

      {/* Sidebar */}
      <aside className="w-72 border-r border-gray-200 p-8 pt-12 space-y-10 hidden lg:flex flex-col bg-white shrink-0">
        <div className="flex items-center space-x-3 text-indigo-600">
           <PawPrint size={32} />
           <span className="font-black text-2xl uppercase tracking-tighter">Paw Connect</span>
        </div>
        <nav className="space-y-3 flex-1">
          <SidebarItem icon={LayoutDashboard} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <SidebarItem icon={PawPrint} label="My Pets" active={activeTab === 'pets'} onClick={() => setActiveTab('pets')} />
          <SidebarItem icon={Users} label="Community" active={activeTab === 'community'} onClick={() => setActiveTab('community')} />
          <SidebarItem icon={MessageCircle} label="Assistant" active={activeTab === 'chat'} onClick={() => setActiveTab('chat')} />
          <SidebarItem icon={Lightbulb} label="Tips Hub" active={activeTab === 'tips'} onClick={() => setActiveTab('tips')} />
        </nav>
        <button onClick={() => setIsSettingsModalFromApp(true)} className="flex items-center space-x-3 px-4 py-3 text-gray-500 hover:text-indigo-600 font-bold">
           <Settings size={20} />
           <span>App Settings</span>
        </button>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative bg-gray-50/50">
        <header className="h-20 border-b border-gray-200 flex items-center justify-between px-8 bg-white/95 backdrop-blur-md z-40 shrink-0">
          <h1 className="font-black text-xl uppercase tracking-widest text-indigo-600 lg:hidden">Paw Connect</h1>
          <div className="hidden lg:block text-gray-400 font-bold text-sm">Welcome back, <span className="text-gray-900">{displayName || 'User'}</span></div>
          <div className="flex items-center space-x-6">
            {/* Replaced notification bell with current day and date */}
            <div className="text-right text-gray-500">
              <p className="text-xs font-semibold leading-none">{currentDay}</p>
              <p className="text-sm font-bold leading-none mt-0.5">{currentDateFormatted}</p>
            </div>
            <div onClick={() => setIsSettingsModalFromApp(true)} className="flex items-center space-x-3 cursor-pointer group">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold group-hover:scale-105 transition-all">PC</div>
              <span className="text-sm font-black hidden sm:block">{displayName || 'Settings'}</span>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {activeTab === 'dashboard' && (
            <div className="p-8 max-w-7xl mx-auto w-full space-y-12">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                {/* Left Col */}
                <div className="lg:col-span-8 space-y-12">
                  <section>
                    <div className="flex items-center justify-between mb-8">
                       <div>
                         <h2 className="text-3xl font-black">Your Furry Family</h2>
                         <p className="text-gray-400 font-bold">Real-time health & status tracking</p>
                       </div>
                       <button onClick={() => setIsAddPetModalOpen(true)} className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-black flex items-center shadow-lg shadow-indigo-200"><Plus className="mr-2" size={20} /> New Pet</button>
                    </div>
                    {pets.length === 0 ? (
                      <div className="bg-white rounded-[40px] p-16 border-2 border-dashed border-gray-100 flex flex-col items-center text-center">
                         <div className="w-24 h-24 bg-indigo-50 rounded-full flex items-center justify-center mb-6 text-indigo-400"><PawPrint size={48} /></div>
                         <h3 className="text-2xl font-black mb-2">No pets registered yet</h3>
                         <p className="text-gray-400 font-bold mb-8">Start your ecosystem by adding your first companion.</p>
                         <button onClick={() => setIsAddPetModalOpen(true)} className="bg-indigo-600 text-white px-10 py-4 rounded-3xl font-black shadow-xl">Add Your First Pet</button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        {pets.map(p => (
                          <div key={p.id} onClick={() => navigateToPetProfile(p.id, 'dashboard')} className="bg-white p-6 rounded-3xl shadow-sm border border-transparent hover:border-indigo-500 hover:shadow-xl transition-all flex items-center space-x-6 cursor-pointer group">
                             <div className="w-20 h-20 rounded-2xl bg-indigo-50 flex items-center justify-center overflow-hidden shrink-0">
                                {p.imageUrl ? <img src={p.imageUrl} className="w-full h-full object-cover" alt={p.name} /> : <span className="text-4xl">🐾</span>}
                             </div>
                             <div>
                                <h3 className="font-black text-xl group-hover:text-indigo-600">{p.name}</h3>
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{p.breed || p.type}</p>
                                <div className="mt-2 flex items-center text-xs font-black text-emerald-500"><CheckCircle2 size={12} className="mr-1" /> Active Profile</div>
                             </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                  
                  <section>
                    <div className="flex items-center justify-between mb-8">
                       <h2 className="text-2xl font-black">Top Training Tips</h2>
                       <button onClick={() => setActiveTab('tips')} className="text-indigo-600 font-bold flex items-center">See Hub <ChevronRight size={18} /></button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                       {trainingTips.slice(0, 2).map(tip => (
                         <div key={tip.id} className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-sm flex flex-col justify-between">
                            <span className="text-4xl mb-6">{tip.icon}</span>
                            <h3 className="text-xl font-black mb-2">{tip.title}</h3>
                            <p className="text-gray-500 font-bold line-clamp-3 leading-relaxed">{tip.content}</p>
                         </div>
                       ))}
                    </div>
                  </section>
                </div>

                {/* Right Col */}
                <div className="lg:col-span-4 space-y-12">
                   <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-[50px] p-10 text-white shadow-2xl relative overflow-hidden group">
                      <div className="relative z-10 space-y-6">
                        <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center"><Lightbulb size={28} /></div>
                        <h3 className="text-3xl font-black leading-tight">Daily AI Wisdom</h3>
                        <p className="text-lg opacity-90 font-medium italic">"{dailyTips.length > 0 ? dailyTips[0].content : "Care for your pets with love."}"</p>
                        <button onClick={() => setActiveTab('tips')} className="w-full bg-white text-indigo-700 py-4 rounded-3xl font-black text-lg shadow-xl">Explore All Tips</button>
                      </div>
                      <div className="absolute -right-20 -bottom-20 w-64 h-64 bg-white/10 rounded-full blur-3xl group-hover:scale-125 transition-transform"></div>
                   </div>

                   <div className="bg-white rounded-[50px] p-10 border border-gray-100 shadow-sm text-center flex flex-col items-center">
                      <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-[30px] flex items-center justify-center mb-8 text-3xl">🩺</div>
                      <h3 className="text-2xl font-black mb-4">Smart Health Lab</h3>
                      <p className="text-gray-500 font-bold mb-8 leading-relaxed">AI-powered condition reports based on breed metrics.</p>
                      <button 
                        onClick={() => pets.length > 0 ? setIsAnalysisPickerOpen(true) : setActiveTab('pets')} 
                        className="w-full bg-gray-100 py-4 rounded-3xl font-black text-lg hover:bg-gray-200 transition-all flex items-center justify-center"
                      >
                         Analyze Pet Health <ChevronDown size={20} className="ml-2" />
                      </button>
                      {isAnalysisPickerOpen && (
                        <div className="mt-4 w-full bg-white border border-gray-100 rounded-3xl shadow-xl overflow-hidden animate-in slide-in-from-top-4">
                           {pets.map(p => (
                             <button 
                                key={p.id} 
                                onClick={() => { setSelectedPetForAnalysis(p); generateReportForPet(p); }} 
                                className="w-full px-6 py-4 text-left hover:bg-indigo-50 font-black text-sm border-b border-gray-50 last:border-0"
                             >
                               {p.name}
                             </button>
                           ))}
                        </div>
                      )}
                   </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'pets' && (
            <div className="p-8 max-w-7xl mx-auto w-full space-y-10">
              <div className="flex flex-col md:flex-row justify-between items-end gap-6">
                <div>
                  <h2 className="text-4xl font-black tracking-tight">Pet Registry</h2>
                  <p className="text-lg text-gray-500 font-bold mt-2">Managing {pets.length} active profiles</p>
                </div>
                <div className="flex items-center space-x-4">
                  {/* Removed the view toggle button */}
                  <button onClick={() => { resetPetForm(); setIsAddPetModalOpen(true); }} className="bg-indigo-600 text-white px-8 py-4 rounded-3xl font-black flex items-center shadow-2xl hover:translate-y-[-4px] transition-all">
                    <Plus className="mr-2" size={24} /> New Registration
                  </button>
                </div>
              </div>

              {/* STANDARD GRID VIEW - Now the only view */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-10">
                {pets.map(pet => (
                  <div key={pet.id} className="bg-white rounded-[50px] border-2 border-gray-100 shadow-sm overflow-hidden group hover:shadow-2xl transition-all duration-500">
                    <div className="h-32 bg-indigo-600 relative">
                      {pet.imageUrl && <img src={pet.imageUrl} className="w-full h-full object-cover opacity-60 blur-[2px]" alt="Background" />}
                      <div className="absolute top-1/2 left-8 -translate-y-1/2 w-24 h-24 rounded-[30px] bg-white shadow-2xl flex items-center justify-center text-5xl overflow-hidden border-8 border-white z-20">
                        {pet.imageUrl ? <img src={pet.imageUrl} className="w-full h-full object-cover" alt={pet.name} /> : <span>🐾</span>}
                      </div>
                    </div>
                    <div className="p-10 pt-16 space-y-6">
                      <h3 onClick={() => navigateToPetProfile(pet.id, 'pets')} className="text-3xl font-black mb-1 cursor-pointer hover:text-indigo-600 hover:underline transition-all">
                        {pet.name}
                      </h3>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="bg-gray-50 p-3 rounded-2xl text-center">
                          <span className="text-[10px] font-black uppercase text-gray-400 block mb-1">Age</span>
                          <span className="font-black text-lg">{pet.age} YR</span>
                        </div>
                        <div className="bg-gray-50 p-3 rounded-2xl text-center">
                          <span className="text-[10px] font-black uppercase text-gray-400 block mb-1">Weight</span>
                          <span className="font-black text-lg">{pet.weight} KG</span>
                        </div>
                        <div className="bg-gray-50 p-3 rounded-2xl text-center">
                          <span className="text-[10px] font-black uppercase text-gray-400 block mb-1">Phone</span>
                          <span className="font-black text-xs block truncate">{currentViewingContact(pet)}</span>
                        </div>
                      </div>
                      <div className="flex space-x-3 pt-2">
                        {/* Removed QR ID button, Analysis button now takes full width */}
                        <button onClick={() => { setSelectedPetForAnalysis(pet); generateReportForPet(pet); }} className="flex-1 flex items-center justify-center bg-indigo-50 text-indigo-600 py-3.5 rounded-2xl text-sm font-black hover:bg-indigo-100 transition-all"><FileText size={18} className="mr-2" /> Analysis</button>
                      </div>
                      <div className="pt-4 border-t border-gray-100">
                         <div className="flex items-center space-x-2 text-indigo-500/60 font-bold text-[10px] uppercase tracking-wider mb-4 px-2 py-1.5 bg-indigo-50/50 rounded-xl justify-center">
                            <Info size={12} />
                            <span>Click on the pet name to open pet profile</span>
                         </div>
                         <div className="flex justify-end space-x-3">
                           <button onClick={() => openEditModal(pet)} className="p-2.5 text-gray-400 hover:text-indigo-600 bg-gray-50 rounded-xl transition-all"><Edit3 size={18} /></button>
                           <button onClick={() => setPetToDelete(pet) || setIsDeleteModalOpen(true)} className="p-2.5 text-gray-400 hover:text-red-500 bg-gray-50 rounded-xl transition-all"><Trash2 size={18} /></button>
                         </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'community' && (
            <div className="p-8 max-w-4xl mx-auto w-full space-y-10">
               <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4">
                 <div className="flex items-center space-x-4"> {/* Added a div to contain h2 and icon */}
                   <h2 className="text-4xl font-black tracking-tight shrink-0">Community Feed</h2>
                   {/* REMOVED: Chat icon next to Community Feed H2 */}
                 </div>
                 <div className="flex items-center flex-wrap gap-4 md:justify-end flex-1 min-w-0">
                   {/* Search Input */}
                   <div ref={communitySearchRef} className="relative flex items-center w-full sm:w-64 bg-gray-50 rounded-2xl px-4 py-2 border-2 border-transparent focus-within:border-indigo-500 transition-all">
                     <Search size={18} className="text-gray-400 shrink-0 mr-3" />
                     <input
                       type="text"
                       value={searchTerm}
                       onChange={(e) => setSearchTerm(e.target.value)}
                       placeholder="Search posts..."
                       className="flex-1 bg-transparent border-none outline-none font-medium placeholder:text-gray-300 pr-8"
                       aria-label="Search posts by content or author"
                     />
                     {searchTerm && (
                       <button
                         onClick={() => setSearchTerm('')}
                         className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                         aria-label="Clear search"
                       >
                         <X size={18} />
                       </button>
                     )}
                   </div>

                   {/* Sort Dropdown */}
                   <div className="relative shrink-0" ref={communitySortRef}>
                     <button
                       onClick={() => setIsCommunitySortOpen(!isCommunitySortOpen)}
                       className={`px-6 py-3 rounded-2xl font-black text-sm flex items-center transition-all ${isCommunitySortOpen ? 'bg-indigo-50 text-indigo-600 border-2 border-indigo-200' : 'bg-white border-2 border-gray-100 text-gray-700 hover:bg-gray-50 shadow-sm'}`}
                       aria-haspopup="true"
                       aria-expanded={isCommunitySortOpen}
                       aria-label={`Current sort order: ${sortOrder.replace(/-/g, ' ')}`}
                     >
                       {sortOrder.replace(/-/g, ' ')}
                       <ChevronDown size={16} className={`ml-2 transition-transform ${isCommunitySortOpen ? 'rotate-180' : ''}`} />
                     </button>
                     {isCommunitySortOpen && (
                       <div className="absolute right-0 mt-3 w-48 bg-white rounded-[30px] shadow-2xl border border-gray-100 py-4 z-50 animate-in slide-in-from-top-2 overflow-hidden" role="menu">
                         {[
                           { label: 'Newest first', value: 'newest' },
                           { label: 'Oldest first', value: 'oldest' },
                           { label: 'Most commented', value: 'most-commented' },
                           { label: 'Most liked', value: 'most-liked' },
                         ].map((option) => (
                           <button
                             key={option.value}
                             onClick={() => { setSortOrder(option.value as typeof sortOrder); setIsCommunitySortOpen(false); }}
                             className={`w-full px-6 py-3 text-left font-bold text-sm transition-all hover:bg-gray-50 ${sortOrder === option.value ? 'text-indigo-600 bg-indigo-50/50' : 'text-gray-600'}`}
                             role="menuitem"
                           >
                             {option.label}
                           </button>
                         ))}
                       </div>
                     )}
                   </div>
                 </div>
               </div>
               {/* Post Composer */}
               <div className="bg-white p-8 rounded-[40px] border-2 border-gray-100 shadow-sm space-y-6">
                  <textarea value={newPostContent} onChange={(e) => setNewPostContent(e.target.value)} placeholder="What's happening in your pet ecosystem?" className="w-full bg-transparent border-none outline-none resize-none min-h-[100px] text-xl font-medium placeholder:text-gray-300" />
                  <div className="flex justify-between items-center border-t border-gray-100 pt-6">
                     <div className="flex space-x-3 flex-wrap"> {/* Added flex-wrap for better layout */}
                        <button
                          onClick={() => setActivePostFilterCategory('ALL')}
                          className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activePostFilterCategory === 'ALL' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-400 hover:text-gray-600'}`}
                          aria-label="Show all post types"
                          aria-pressed={activePostFilterCategory === 'ALL'}
                        >
                          ALL
                        </button>
                        {Object.values(PostType).map(type => {
                          const Icon = POST_TYPE_ICONS[type];
                           return (
                              <button 
                                key={type} 
                                onClick={() => { setActivePostFilterCategory(type); setNewPostType(type); }} 
                                className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center ${activePostFilterCategory === type ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-400 hover:text-gray-600'}`}
                                aria-label={`Filter by post type: ${type}`}
                                aria-pressed={activePostFilterCategory === type}
                              >
                                {Icon && <Icon size={14} className="mr-1" />}
                                {type}
                              </button>
                          );
                        })}
                        <button 
                          onClick={() => handleEnhancePostClick(newPostContent, newPostType)} 
                          disabled={!newPostContent.trim()}
                          className="px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center bg-emerald-50 text-emerald-600 hover:bg-emerald-100 disabled:opacity-50 mt-2" // Added mt-2 here
                          title="Enhance this post draft with AI"
                        >
                          <FilePenLine size={14} className="mr-1" />
                          Enhance with AI
                        </button>
                     </div>
                     <button onClick={createPost} disabled={!newPostContent.trim()} className="bg-indigo-600 text-white px-8 py-3 rounded-2xl font-black shadow-lg shadow-indigo-500/20 hover:scale-105 active:scale-95 transition-all">Post</button>
                  </div>
               </div>
               {/* Feed */}
               <div className="space-y-8 pb-20">
                  {sortedPosts.length === 0 ? (
                    <div className="text-center py-20 text-gray-300 font-bold">No community posts yet. Be the first!</div>
                  ) : sortedPosts.map(post => {
                    const TypeIcon = POST_TYPE_ICONS[post.type]; // Access mapping directly for post.type string
                    return (
                    <div key={post.id} className="bg-white rounded-[40px] border border-gray-100 shadow-sm p-8 space-y-6 animate-in fade-in zoom-in duration-300">
                       <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                             <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center font-black text-indigo-600">{post.author[0]}</div>
                             <div>
                                <p className="font-black text-xl">{post.author}</p>
                                <p className="text-[10px] text-gray-400 uppercase font-black">{new Date(post.createdAt).toLocaleDateString()}</p>
                             </div>
                          </div>
                          <span className="px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-indigo-50 text-indigo-600 flex items-center">
                            {TypeIcon && <TypeIcon size={14} className="mr-1" />} {post.type}
                          </span>
                       </div>
                       <p className="text-xl leading-relaxed font-bold">{post.content}</p>
                       <div className="flex items-center space-x-6 text-gray-400">
                          <button onClick={() => likePost(post.id)} className={`flex items-center space-x-2 transition-colors ${post.likedByMe ? 'text-red-500' : 'hover:text-red-500'}`}>
                            {/* Assuming 'Heart' icon is not exclusively for 'Stories' type, keep it. */}
                            <Heart size={20} className={post.likedByMe ? 'fill-red-500' : ''} />
                            <span className="font-bold">{post.likes}</span>
                          </button>
                          <button onClick={() => setActiveCommentPostId(activeCommentPostId === post.id ? null : post.id)} className="flex items-center space-x-2 hover:text-indigo-600">
                            <MessageSquare size={20} />
                            <span className="font-bold">{post.comments.length}</span>
                          </button>
                           {/* AI Summary for replies button */}
                           <button 
                             onClick={() => handleSummarizeReplies(post.id)} 
                             disabled={isSummaryLoading}
                             className="flex items-center space-x-2 hover:text-emerald-600 text-gray-400"
                             title="Get AI Summary of replies"
                           >
                             {isSummaryLoading && currentSummaryContent === null && currentSummaryType === 'replies' ? <Loader2 size={20} className="animate-spin" /> : <BookOpen size={20} />}
                             <span className="font-bold hidden sm:inline">AI Summary</span>
                           </button>
                           {/* New AI Summarize Post (content) button */}
                           <button 
                             onClick={() => handleSummarizePostContent(post.content, post.type)} 
                             disabled={isSummaryLoading}
                             className="flex items-center space-x-2 hover:text-purple-600 text-gray-400"
                             title="Get AI Summary of this post"
                           >
                             {isSummaryLoading && currentSummaryContent === null && currentSummaryType === 'post' ? <Loader2 size={20} className="animate-spin" /> : <BookOpen size={20} />}
                             <span className="font-bold hidden sm:inline">Summarize Post</span>
                           </button>
                       </div>
                       {activeCommentPostId === post.id && (
                          <div className="flex items-center space-x-3 pt-2">
                             <input ref={replyInputRef} value={replyText} onChange={(e) => setReplyText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addComment(post.id)} placeholder="Type a comment..." className="flex-1 bg-gray-50 border-none rounded-2xl px-5 py-3 outline-none font-bold text-sm" />
                             <button onClick={() => addComment(post.id)} className="bg-indigo-600 text-white p-3 rounded-xl"><Send size={18} /></button>
                          </div>
                       )}
                       {post.comments.length > 0 && (
                          <div className="space-y-4 pt-4 border-t border-gray-50">
                             {post.comments.map(c => (
                               <div key={c.id} className="flex space-x-3">
                                  <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center font-black text-xs">{c.author[0]}</div>
                                  <div className="bg-gray-50 px-4 py-2 rounded-2xl flex-1">
                                     <span className="font-black text-xs block mb-1">{c.author}</span>
                                     <p className="text-sm font-medium">{c.content}</p>
                                  </div>
                               </div>
                             ))}
                          </div>
                       )}
                    </div>
                  );
                  })}
               </div>
            </div>
          )}

          {activeTab === 'chat' && (
            <div className="flex-1 flex flex-col max-w-5xl mx-auto w-full p-8 h-full">
               <div className="flex items-center space-x-6 mb-8">
                  <div className="w-16 h-16 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-xl animate-pulse shrink-0"><MessageCircle size={32} /></div>
                  <div>
                     <h2 className="text-3xl font-black tracking-tight">Paw connect AI</h2>
                     <p className="text-xs text-emerald-500 font-black uppercase tracking-[0.2em] mt-1">Live Diagnostic Mode</p>
                  </div>
               </div>
               <div className="flex-1 bg-white rounded-[45px] border-2 border-gray-100 shadow-xl flex flex-col overflow-hidden mb-10">
                  <div className="flex-1 overflow-y-auto p-10 space-y-8 scroll-smooth custom-scrollbar">
                     {chatMessages.length === 0 && <div className="text-center py-20 text-gray-300 font-bold">Start a conversation about pet care.</div>}
                     {chatMessages.map((msg, idx) => (
                       <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[85%] px-7 py-5 rounded-[30px] text-lg leading-relaxed font-medium ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-gray-50 text-gray-800 rounded-tl-none border border-gray-100 shadow-sm'}`}>
                             <FormattedText text={msg.text} />
                          </div>
                       </div>
                     ))}
                     {isChatLoading && <div className="flex justify-start"><div className="bg-gray-100 px-6 py-4 rounded-3xl animate-pulse text-gray-500 font-bold">Analyzing...</div></div>}
                  </div>
                  <div className="p-8 border-t border-gray-100 flex space-x-4 bg-gray-50/50 shrink-0">
                     <input value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendMessage()} placeholder="Ask follow-up questions..." className="flex-1 bg-white border-none rounded-2xl px-6 py-4 outline-none font-bold shadow-inner" />
                     <button onClick={sendMessage} disabled={isChatLoading || !chatInput.trim()} className="bg-indigo-600 text-white p-5 rounded-2xl hover:bg-indigo-700 transition-all shadow-lg active:scale-95 disabled:opacity-50"><Send size={24} /></button>
                  </div>
               </div>
            </div>
          )}

          {activeTab === 'tips' && (
            <div className="p-8 max-w-7xl mx-auto w-full space-y-12 mb-20">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                  <h2 className="text-4xl font-black tracking-tight">AI Guides Hub</h2>
                  <p className="text-lg text-gray-500 font-bold mt-2">Personalized wisdom generated by Paw Connect AI.</p>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="relative" ref={tipFilterRef}>
                    <button onClick={() => setIsTipFilterOpen(!isTipFilterOpen)} className={`px-8 py-3.5 rounded-3xl font-black text-lg flex items-center transition-all ${selectedTipCategory ? 'bg-indigo-50 text-indigo-600 border-2 border-indigo-200' : 'bg-white border-2 border-gray-100 text-gray-700 hover:bg-gray-50 shadow-sm'}`}>
                      <Filter size={20} className="mr-2" />
                      {selectedTipCategory || 'Sort'}
                      <ChevronDown size={18} className={`ml-2 transition-transform ${isTipFilterOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {isTipFilterOpen && (
                      <div className="absolute right-0 mt-3 w-56 bg-white rounded-[30px] shadow-2xl border border-gray-100 py-4 z-50 animate-in slide-in-from-top-2 overflow-hidden">
                        {['Health', 'Nutrition', 'Training', 'General'].map((cat) => (
                          <button key={cat} onClick={() => { setSelectedTipCategory(cat); setIsTipFilterOpen(false); }} className={`w-full px-8 py-3.5 text-left font-bold text-sm transition-all hover:bg-gray-50 ${selectedTipCategory === cat ? 'text-indigo-600 bg-indigo-50/50' : 'text-gray-600'}`}>
                            {cat}
                          </button>
                        ))}
                        {selectedTipCategory && (
                          <button onClick={() => { setSelectedTipCategory(null); setIsTipFilterOpen(false); }} className="w-full px-8 py-3.5 text-left font-black text-xs uppercase tracking-widest text-indigo-600 border-t border-gray-50 mt-2 hover:bg-indigo-50 transition-all">
                            Clear Filter
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  <button onClick={refreshTips} disabled={isTipsLoading} className="bg-indigo-600 text-white px-8 py-3.5 rounded-3xl font-black text-lg flex items-center shadow-xl hover:bg-indigo-700 disabled:opacity-50">
                     <RotateCw size={20} className={`mr-2 ${isTipsLoading ? 'animate-spin' : ''}`} /> {isTipsLoading ? 'Syncing...' : 'Sync AI wisdom'}
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {filteredTips.map(tip => (
                    <div key={tip.id} className="bg-white p-10 rounded-[50px] border-2 border-gray-100 shadow-sm hover:shadow-xl hover:border-indigo-500 transition-all flex flex-col h-full overflow-hidden">
                        <div className="flex items-center justify-between mb-8">
                          <span className="text-5xl shrink-0">{tip.icon}</span>
                          <span className="px-4 py-1.5 rounded-xl bg-indigo-50 text-indigo-600 text-[10px] font-black uppercase tracking-widest">{tip.category}</span>
                        </div>
                        <h3 className="text-2xl font-black mb-4 truncate">{tip.title}</h3>
                        <p className="text-gray-500 leading-relaxed font-bold italic line-clamp-4">{tip.content}</p>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {activeTab === 'pet-profile' && currentViewingPet && (
            <div className="p-8 max-w-5xl mx-auto w-full space-y-10 pb-20 animate-in fade-in duration-500">
               <div className="flex items-center space-x-4 mb-6">
                  <button onClick={() => setActiveTab(profileSource === 'dashboard' ? 'dashboard' : 'pets')} className="p-3 bg-white border border-gray-100 rounded-2xl text-gray-400 hover:text-indigo-600 shadow-sm"><ChevronLeft size={24} /></button>
                  <h2 className="text-3xl font-black tracking-tight">Pet Profile</h2>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
                  <div className="md:col-span-4 space-y-8">
                     <div className="bg-white rounded-[50px] p-2 overflow-hidden shadow-sm border-2 border-gray-100">
                        <div className="aspect-square rounded-[45px] bg-indigo-50 flex items-center justify-center overflow-hidden">
                           {currentViewingPet.imageUrl ? <img src={currentViewingPet.imageUrl} className="w-full h-full object-cover" alt={currentViewingPet.name} /> : <span className="text-8xl">🐾</span>}
                        </div>
                     </div>
                     <div className="bg-indigo-600 text-white rounded-[40px] p-8 shadow-xl space-y-6 text-center">
                        <div className="flex items-center justify-center space-x-4"><Activity size={24} /><h3 className="text-xl font-black">Health Score</h3></div>
                        <div className="text-7xl font-black">{currentViewingPet.healthScore || '85'}</div>
                        <button onClick={() => generateReportForPet(currentViewingPet)} className="w-full bg-white text-indigo-600 py-4 rounded-2xl font-black shadow-lg">Run Analysis</button>
                     </div>
                  </div>
                  <div className="md:col-span-8 space-y-10">
                     <div className="bg-white rounded-[50px] p-10 border-2 border-gray-100 shadow-sm space-y-8">
                        <div className="flex justify-between items-start">
                           <div>
                              <h3 className="text-4xl font-black">{currentViewingPet.name}</h3>
                              <p className="text-indigo-600 font-bold uppercase tracking-[0.2em] text-sm mt-1">{currentViewingPet.breed || currentViewingPet.type}</p>
                           </div>
                           <div className="flex space-x-2">
                              <button onClick={() => openEditModal(currentViewingPet)} className="p-3 bg-gray-50 text-gray-400 hover:text-indigo-600 rounded-2xl"><Edit3 size={20} /></button>
                              <button onClick={() => setPetToDelete(currentViewingPet) || setIsDeleteModalOpen(true)} className="p-3 bg-gray-50 text-gray-400 hover:text-red-500 rounded-2xl"><Trash2 size={20} /></button>
                           </div>
                        </div>
                        <div className="grid grid-cols-3 gap-6">
                           <div className="bg-gray-50 rounded-[30px] p-6 text-center">
                              <span className="text-[10px] font-black uppercase text-gray-400 block mb-2">Age</span>
                              <p className="text-xl font-black">{currentViewingPet.age} YR</p>
                           </div>
                           <div className="bg-gray-50 rounded-[30px] p-6 text-center">
                              <span className="text-[10px] font-black uppercase text-gray-400 block mb-2">Weight</span>
                              <p className="text-xl font-black">{currentViewingPet.weight} KG</p>
                           </div>
                           <div className="bg-gray-50 rounded-[30px] p-6 text-center">
                              <span className="text-[10px] font-black uppercase text-gray-400 block mb-2">Contact</span>
                              <p className="text-xl font-black">{currentViewingContact(currentViewingPet)}</p>
                           </div>
                        </div>
                        <div className="space-y-6 pt-4">
                           <div className="flex items-center justify-between">
                              <h4 className="text-xs font-black uppercase tracking-[0.3em] text-gray-400">Medical Log</h4>
                              <button onClick={() => setIsAddRecordModalOpen(true)} className="flex items-center text-indigo-600 font-black text-xs uppercase tracking-widest hover:bg-indigo-50 px-3 py-2 rounded-xl transition-all">
                                <Plus size={14} className="mr-1.5" /> Add Report
                              </button>
                           </div>
                           {currentViewingPet.records && currentViewingPet.records.length > 0 ? (
                             <div className="space-y-4">
                               {currentViewingPet.records.map(r => (
                                 <div key={r.id} className="bg-gray-50 p-6 rounded-[30px] border border-gray-100 flex items-start space-x-6">
                                   <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-inner shrink-0">
                                     {r.fileType === 'pdf' ? <FileText className="text-red-500" /> : r.fileType === 'video' ? <Video className="text-blue-500" /> : <ImageIcon className="text-emerald-500" />}
                                   </div>
                                   <div className="flex-1 min-w-0">
                                     <div className="flex justify-between items-start mb-1"><h5 className="font-black truncate pr-4">{r.fileName}</h5><span className="text-[8px] font-black text-gray-400">{new Date(r.timestamp).toLocaleDateString()}</span></div>
                                     <p className="text-sm text-gray-500 font-medium mb-3 line-clamp-2">{r.description}</p>
                                     <div className="flex items-center space-x-3">
                                        <button onClick={() => handleViewReport(r)} className="text-indigo-600 text-[10px] font-black uppercase tracking-widest hover:underline">View Report</button>
                                        <button onClick={() => handleDeleteRecord(r)} className="text-red-500 text-[10px] font-black uppercase tracking-widest hover:underline flex items-center">
                                           <Trash2 size={12} className="mr-1" /> Delete
                                        </button>
                                     </div>
                                   </div>
                                 </div>
                               ))}
                             </div>
                           ) : <div className="text-center py-12 text-gray-300 font-bold border-2 border-dashed rounded-[40px]">No medical events logged.</div>}
                        </div>
                     </div>
                  </div>
               </div>
            </div>
          )}
        </div>
      </main>

      {/* SETTINGS MODAL FULLY RESTORED */}
      {isSettingsModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-2xl">
          <div className="bg-white w-full max-w-2xl rounded-[50px] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-gray-100">
             <div className="p-10 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 shrink-0">
                <h3 className="text-3xl font-black tracking-tighter uppercase text-indigo-600">App Settings</h3>
                <button onClick={() => setIsSettingsModalFromApp(false)} className="p-4 bg-white rounded-2xl hover:bg-gray-100"><X size={24} /></button>
             </div>
             <div className="p-10 space-y-8 overflow-y-auto custom-scrollbar flex-1">
                <div className="flex items-center space-x-6 pb-8 border-b border-gray-100">
                   <div className="w-24 h-24 rounded-3xl bg-indigo-600 flex items-center justify-center text-white text-4xl font-black shadow-xl shrink-0">PC</div>
                   <div className="flex-1 space-y-4">
                      {/* User ID - Read Only */}
                      <div>
                        <label className="text-[10px] font-black text-gray-400 block mb-1 uppercase tracking-widest">USER ID (READ-ONLY)</label>
                        <input value={userId} readOnly className="w-full bg-gray-50 border-none rounded-xl px-4 py-2 font-bold text-gray-600 text-sm focus:ring-0 cursor-not-allowed" />
                      </div>
                      {/* Username - Required */}
                      <div>
                        <label className="text-[10px] font-black text-gray-400 block mb-1 uppercase tracking-widest">USERNAME</label>
                        <input
                          value={settingsForm.username}
                          onChange={(e) => handleSettingsChange('username', e.target.value)}
                          className={`w-full bg-gray-50 border-none rounded-xl px-4 py-2 font-black text-lg focus:ring-2 ${usernameError ? 'focus:ring-red-300 border-red-500' : 'focus:ring-indigo-100'}`}
                          placeholder="unique_username"
                          aria-invalid={usernameError ? "true" : "false"}
                          aria-describedby="username-error"
                          required
                        />
                        {usernameError && (
                          <p id="username-error" className="text-red-500 text-xs font-bold mt-1 ml-2 flex items-center">
                            <AlertTriangle size={14} className="mr-1" /> {usernameError}
                          </p>
                        )}
                      </div>
                      {/* Display Name - Optional */}
                      <div>
                        <label className="text-[10px] font-black text-gray-400 block mb-1 uppercase tracking-widest">DISPLAY NAME (OPTIONAL)</label>
                        <input
                          value={settingsForm.displayName}
                          onChange={(e) => handleSettingsChange('displayName', e.target.value)}
                          className="w-full bg-gray-50 border-none rounded-xl px-4 py-2 font-black text-lg focus:ring-2 focus:ring-indigo-100"
                          placeholder="Enter display name"
                        />
                      </div>
                      {/* Email Address - Optional */}
                      <div>
                        <label className="text-[10px] font-black text-gray-400 block mb-1 uppercase tracking-widest">EMAIL ADDRESS (OPTIONAL)</label>
                        <input
                          type="email"
                          value={settingsForm.userEmail}
                          onChange={(e) => handleSettingsChange('userEmail', e.target.value)}
                          className="w-full bg-gray-50 border-none rounded-xl px-4 py-2 font-black text-lg focus:ring-2 focus:ring-indigo-100"
                          placeholder="your@email.com"
                        />
                      </div>
                   </div>
                </div>
                
                <div className="space-y-4">
                  <button onClick={() => handleSettingsChange('notificationsEnabled', !settingsForm.notificationsEnabled)} className="w-full flex items-center justify-between p-6 bg-gray-50 rounded-3xl group transition-all hover:bg-white border border-transparent hover:border-100">
                     <div className="text-left"><p className="font-black text-sm">Push Notifications</p><p className="text-xs text-gray-400 font-bold">Health alerts & community updates</p></div>
                     {settingsForm.notificationsEnabled ? <ToggleRight size={40} className="text-indigo-600" /> : <ToggleLeft size={40} className="text-gray-300" />}
                  </button>
                </div>

                <div className="pt-8 space-y-4">
                   <button onClick={handleSaveChanges} disabled={!canSaveSettings} className="w-full bg-indigo-600 text-white py-5 rounded-3xl font-black text-lg shadow-xl shadow-indigo-100 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed">Save Changes</button>
                   <button onClick={handleSignOut} className="w-full flex items-center justify-center space-x-3 text-red-500 font-black py-4 hover:bg-red-50 rounded-2xl transition-all"><LogOut size={20} /><span>Sign Out of Ecosystem</span></button>
                </div>
             </div>
          </div>
        </div>
      )}

      {/* Restoration of Pet and Medical Modals */}
      {isAddPetModalOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl">
          <div className="bg-white w-full max-w-xl rounded-[40px] shadow-2xl flex flex-col max-h-[85vh] overflow-hidden border border-gray-100 animate-in zoom-in">
            <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
               <h3 className="text-2xl font-black uppercase tracking-tighter">{editingPet ? 'Update Registration' : 'Register New Pet'}</h3>
               <button onClick={() => { setIsAddPetModalOpen(false); resetPetForm(); }} className="p-3 bg-white/50 rounded-xl hover:bg-gray-100"><X size={24} /></button>
            </div>
            <form onSubmit={handleAddPet} className="p-10 space-y-8 overflow-y-auto custom-scrollbar flex-1">
               <div className="flex flex-col items-center mb-4">
                  <div onClick={() => fileInputRef.current?.click()} className="w-28 h-28 rounded-[30px] bg-gray-100 border-4 border-dashed border-indigo-200 flex flex-col items-center justify-center cursor-pointer hover:scale-105 transition-all overflow-hidden relative shadow-inner">
                    {petForm.imageUrl ? <img src={petForm.imageUrl} className="w-full h-full object-cover" alt="Preview" /> : <><Upload size={24} className="text-indigo-300 mb-1" /><span className="text-[10px] font-black text-indigo-300 uppercase">Add Photo</span></>}
                  </div>
                  <input type="file" ref={fileInputRef} onChange={(e) => { const f = e.target.files?.[0]; if(f) { const r = new FileReader(); r.onloadend = () => setPetForm({...petForm, imageUrl: r.result as string}); r.readAsDataURL(f); }}} accept="image/*" className="hidden" />
               </div>
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                 <div className="sm:col-span-2">
                    <label className="text-[10px] font-black text-gray-400 block mb-2 uppercase tracking-widest">Pet Name</label>
                    <input ref={nameInputRef} required value={petForm.name} onChange={(e) => setPetForm({...petForm, name: e.target.value})} className="w-full bg-gray-50 rounded-2xl px-5 py-3 outline-none font-black text-lg border-2 border-transparent focus:border-indigo-500" placeholder="Buddy" />
                 </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-400 block mb-2 uppercase tracking-widest">Species</label>
                    <select value={petForm.type} onChange={(e) => setPetForm({...petForm, type: e.target.value as PetType})} className="w-full bg-gray-50 rounded-2xl px-5 py-3 outline-none font-black">
                      {Object.values(PetType).map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-400 block mb-2 uppercase tracking-widest">Breed Details</label>
                    <input value={petForm.breed} onChange={(e) => setPetForm({...petForm, breed: e.target.value})} className="w-full bg-gray-50 rounded-2xl px-5 py-3 outline-none font-black" placeholder="Golden Retriever" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-400 block mb-2 uppercase tracking-widest">Age (Years)</label>
                    <input value={petForm.age} onChange={(e) => setPetForm({...petForm, age: e.target.value.replace(/\D/g, '').slice(0, 3)})} className="w-full bg-gray-50 rounded-2xl px-5 py-3 outline-none font-black" placeholder="3" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-400 block mb-2 uppercase tracking-widest">Weight (KG)</label>
                    <input value={petForm.weight} onChange={(e) => setPetForm({...petForm, weight: e.target.value.replace(/[^\d.]/g, '').slice(0, 3)})} className="w-full bg-gray-50 rounded-2xl px-5 py-3 outline-none font-black" placeholder="12.5" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-[10px] font-black text-gray-400 block mb-2 uppercase tracking-widest">Emergency Phone (10 Digits)</label>
                    <input required value={petForm.emergencyContact} onChange={(e) => setPetForm({...petForm, emergencyContact: e.target.value.replace(/\D/g, '').slice(0, 10)})} className="w-full bg-gray-50 rounded-2xl px-5 py-3 outline-none font-black" placeholder="1234567890" />
                  </div>
               </div>
               <button type="submit" disabled={isSyncing} className="w-full bg-indigo-600 text-white py-5 rounded-3xl font-black text-xl shadow-xl active:scale-95 disabled:opacity-70 flex items-center justify-center">
                  {isSyncing ? <><RotateCw size={24} className="mr-2 animate-spin" /> Syncing...</> : 'Save Companion Details'}
               </button>
            </form>
          </div>
        </div>
      )}

      {isAddRecordModalOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl">
          <div className="bg-white w-full max-w-xl rounded-[40px] shadow-2xl flex flex-col max-h-[85vh] overflow-hidden animate-in zoom-in border border-gray-100">
            <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
               <h3 className="text-2xl font-black uppercase tracking-tighter">Add Medical Record</h3>
               <button onClick={() => setIsAddRecordModalOpen(false)} className="p-3 bg-white/50 rounded-xl hover:bg-gray-100"><X size={24} /></button>
            </div>
            <form onSubmit={handleAddMedicalReport} className="p-10 space-y-8 overflow-y-auto custom-scrollbar flex-1">
               <div className="space-y-4">
                  <div onClick={() => recordFileInputRef.current?.click()} className="w-full h-48 rounded-[30px] border-4 border-dashed border-indigo-200 bg-gray-50 flex flex-col items-center justify-center cursor-pointer relative hover:bg-gray-100 transition-all">
                    {recordFile ? (
                      <div className="text-center p-4"><p className="font-black text-indigo-600 break-all">{recordFile.name}</p></div>
                    ) : (
                      <div className="text-center"><FileUp size={48} className="text-indigo-300 mx-auto mb-4" /><p className="font-black text-gray-400">PDF, Images, or Videos</p></div>
                    )}
                  </div>
                  <input type="file" ref={recordFileInputRef} onChange={(e) => setRecordFile(e.target.files?.[0] || null)} accept=".pdf, image/*, video/*" className="hidden" />
               </div>
               <div><label className="text-[10px] font-black text-gray-400 block mb-2 uppercase tracking-widest">NOTES</label><textarea value={recordDescription} onChange={(e) => setRecordDescription(e.target.value)} placeholder="Description of event or findings..." className="w-full bg-gray-50 rounded-2xl px-6 py-4 outline-none font-bold min-h-[120px] shadow-inner" /></div>
               <button type="submit" disabled={!recordFile || isRecordUploading} className="w-full bg-indigo-600 text-white py-5 rounded-3xl font-black text-xl shadow-xl active:scale-95 disabled:opacity-50 flex items-center justify-center">
                  {isRecordUploading ? 'Processing...' : 'Sync Medical Log'}
               </button>
            </form>
          </div>
        </div>
      )}

      {isDeleteModalOpen && petToDelete && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
           <div className="bg-white w-full max-w-md rounded-[50px] shadow-2xl p-10 flex flex-col items-center text-center space-y-6">
              <div className="w-20 h-20 bg-red-50 rounded-[30px] flex items-center justify-center text-red-600 shadow-inner"><AlertTriangle size={40} /></div>
              <h3 className="text-3xl font-black">Delete {petToDelete.name}?</h3>
              <p className="text-gray-500 font-bold leading-relaxed">This record will be permanently purged from the ecosystem.</p>
              <div className="flex flex-col w-full space-y-3">
                 <button onClick={executeDeletePet} className="bg-red-600 text-white py-4 rounded-3xl font-black shadow-xl hover:bg-red-700 active:scale-95 transition-all">Delete Permanently</button>
                 <button onClick={() => setIsDeleteModalOpen(false)} className="bg-gray-100 text-gray-500 py-4 rounded-3xl font-black text-sm hover:bg-gray-200">Keep Record</button>
              </div>
           </div>
        </div>
      )}

      {isDeleteRecordModalOpen && recordToDelete && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
           <div className="bg-white w-full max-w-md rounded-[50px] shadow-2xl p-10 flex flex-col items-center text-center space-y-6">
              <div className="w-20 h-20 bg-red-50 rounded-[30px] flex items-center justify-center text-red-600 shadow-inner"><AlertTriangle size={40} /></div>
              <h3 className="text-2xl font-black">Delete Report "{recordToDelete.fileName}"?</h3>
              <p className="text-gray-500 font-bold leading-relaxed">Are you sure you want to delete this medical report? This action cannot be undone.</p>
              <div className="flex flex-col w-full space-y-3">
                 <button onClick={executeDeleteRecord} className="bg-red-600 text-white py-4 rounded-3xl font-black shadow-xl hover:bg-red-700 active:scale-95 transition-all">Confirm Delete</button>
                 <button onClick={() => setIsDeleteRecordModalOpen(false)} className="bg-gray-100 text-gray-500 py-4 rounded-3xl font-black text-sm hover:bg-gray-200">Cancel</button>
              </div>
           </div>
        </div>
      )}

      {/* QR Code Modal (without print/download) */}
      {qrPet && (
        <div id="qr-modal-wrapper" className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-black/90 backdrop-blur-2xl">
          <div className="bg-white w-full max-w-sm rounded-[60px] p-10 flex flex-col items-center border-4 border-gray-100 space-y-6 animate-in zoom-in shadow-2xl">
             <div className="flex justify-between w-full">
                <h3 className="text-xl font-black uppercase tracking-widest text-indigo-600">Pet QR ID</h3>
                <button onClick={() => setQrPet(null)} className="p-3 bg-gray-100 rounded-2xl hover:bg-gray-200 transition-all"><X size={20} /></button>
             </div>

             <div className="bg-white p-6 rounded-[45px] shadow-xl border-2 border-gray-50">
                <QRCodeCanvas value={`PET PROFILE\nName: ${qrPet.name}\nType: ${qrPet.type}\nEmergency: ${qrPet.emergencyContact}`} size={200} level="H" />
             </div>
             <p className="font-black text-3xl">{qrPet.name}</p>
             {/* Removed Print Tag button */}
          </div>
        </div>
      )}

      {/* AI Summary Modal */}
      {isSummaryModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <div className="bg-white w-full max-w-xl rounded-[40px] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-gray-100 animate-in zoom-in">
            <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-indigo-50/50">
               <h3 className="text-2xl font-black uppercase tracking-tighter text-indigo-600">
                 {currentSummaryType === 'post' ? 'Community Post Summary' : 
                  currentSummaryType === 'replies' ? 'Community Replies Summary' : 'AI Summary'}
               </h3>
               <button onClick={() => setIsSummaryModalOpen(false)} className="p-3 bg-white/50 rounded-xl hover:bg-gray-100"><X size={24} /></button>
            </div>
            <div className="p-10 space-y-6 overflow-y-auto custom-scrollbar flex-1">
              {isSummaryLoading ? (
                <div className="flex flex-col items-center justify-center py-10 text-gray-400 font-bold text-lg">
                  <Loader2 size={36} className="animate-spin mb-4 text-indigo-400" />
                  Generating summary...
                </div>
              ) : (
                <FormattedText text={currentSummaryContent || "No summary available."} />
              )}
            </div>
            <div className="p-8 border-t border-gray-100 flex justify-end">
              <button onClick={() => setIsSummaryModalOpen(false)} className="bg-indigo-600 text-white px-8 py-4 rounded-3xl font-black shadow-lg hover:bg-indigo-700 active:scale-95 transition-all">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* AI Enhance Post Modal */}
      {isEnhancePostModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <div className="bg-white w-full max-w-2xl rounded-[40px] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-gray-100 animate-in zoom-in">
            <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-purple-50/50">
               <h3 className="text-2xl font-black uppercase tracking-tighter text-purple-600">AI Post Enhancer</h3>
               <button onClick={() => setIsEnhancePostModalOpen(false)} className="p-3 bg-white/50 rounded-xl hover:bg-gray-100"><X size={24} /></button>
            </div>
            <div className="p-10 space-y-8 overflow-y-auto custom-scrollbar flex-1">
              <div className="space-y-4">
                <label className="text-[10px] font-black text-gray-400 block mb-2 uppercase tracking-widest">Original Post Content</label>
                <textarea 
                  value={postToEnhanceContent} 
                  onChange={(e) => setPostToEnhanceContent(e.target.value)}
                  placeholder="Paste your post content here..." 
                  className="w-full bg-gray-50 rounded-2xl px-6 py-4 outline-none font-bold min-h-[120px] shadow-inner resize-none" 
                  aria-label="Original post content"
                />
              </div>
              <div className="space-y-4">
                <label className="text-[10px] font-black text-gray-400 block mb-2 uppercase tracking-widest">Post Category</label>
                <select 
                  value={postToEnhanceType} 
                  onChange={(e) => setPostToEnhanceType(e.target.value as PostType)}
                  className="w-full bg-gray-50 rounded-2xl px-6 py-4 outline-none font-bold shadow-inner"
                  aria-label="Post category"
                >
                  {Object.values(PostType).map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
              <button 
                onClick={handleGenerateEnhancement} 
                disabled={isEnhancingPost || !postToEnhanceContent.trim()} 
                className="w-full bg-purple-600 text-white py-4 rounded-3xl font-black text-lg shadow-xl hover:bg-purple-700 active:scale-95 disabled:opacity-50 flex items-center justify-center"
              >
                {isEnhancingPost ? <><Loader2 size={24} className="animate-spin mr-2" /> Enhancing...</> : <><FilePenLine size={24} className="mr-2" /> Generate Enhancement</>}
              </button>

              {(enhancedPostTitle || enhancedPostContent) && (
                <div className="pt-8 space-y-6 border-t border-gray-100 animate-in fade-in duration-300">
                  <h4 className="text-xs font-black uppercase tracking-[0.3em] text-gray-400">AI Suggestions</h4>
                  {enhancedPostTitle && (
                    <div className="bg-emerald-50 px-6 py-4 rounded-2xl">
                      <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest mb-1">Suggested Title</p>
                      <p className="font-bold text-lg text-emerald-800">{enhancedPostTitle}</p>
                    </div>
                  )}
                  {enhancedPostContent && (
                    <div className="bg-gray-50 p-6 rounded-[30px] border border-gray-100 shadow-sm">
                      <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Improved Post</p>
                      <FormattedText text={enhancedPostContent} />
                    </div>
                  )}
                  <button 
                    onClick={handleUseEnhancedPost} 
                    className="w-full bg-indigo-600 text-white py-4 rounded-3xl font-black text-lg shadow-xl hover:bg-indigo-700 active:scale-95 transition-all"
                  >
                    Use This Post
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Internal utility for masking contact
function currentViewingContact(pet: Pet): string {
    return pet.emergencyContact.length > 4 ? `***${pet.emergencyContact.slice(-4)}` : pet.emergencyContact;
}

export default App;