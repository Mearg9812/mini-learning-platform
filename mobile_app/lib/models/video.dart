class Video {
  final String id;
  final String title;
  final String description;
  final String category;
  final int duration;
  final String thumbnail;
  final String activeSource;
  final String youtubeUrl;
  final String cloudflareUrl;
  final String course;

  Video({
    required this.id,
    required this.title,
    required this.description,
    required this.category,
    required this.duration,
    required this.thumbnail,
    required this.activeSource,
    required this.youtubeUrl,
    required this.cloudflareUrl,
    required this.course,
  });

  factory Video.fromJson(Map<String, dynamic> json) {
    return Video(
      id: json['id'] ?? '',
      title: json['title'] ?? '',
      description: json['description'] ?? '',
      category: json['category'] ?? '',
      duration: json['duration'] ?? 0,
      thumbnail: json['thumbnail'] ?? '',
      activeSource: json['activeSource'] ?? 'YOUTUBE',
      youtubeUrl: json['youtubeUrl'] ?? '',
      cloudflareUrl: json['cloudflareUrl'] ?? '',
      course: json['course'] ?? 'UNASSIGNED',
    );
  }
}
