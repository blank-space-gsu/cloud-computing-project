import 'package:flutter/material.dart';

class FeatureSectionData {
  const FeatureSectionData({
    required this.title,
    required this.items,
    this.icon = Icons.layers_outlined,
  });

  final String title;
  final List<String> items;
  final IconData icon;
}

class FeatureSnapshotData {
  const FeatureSnapshotData({
    required this.label,
    required this.value,
    required this.caption,
    this.icon = Icons.bolt_rounded,
  });

  final String label;
  final String value;
  final String caption;
  final IconData icon;
}

class FeaturePlaceholderPage extends StatelessWidget {
  const FeaturePlaceholderPage({
    super.key,
    required this.eyebrow,
    required this.title,
    required this.summary,
    required this.focusTags,
    required this.sections,
    required this.nextStep,
    required this.heroIcon,
    required this.snapshots,
    this.footer,
  });

  final String eyebrow;
  final String title;
  final String summary;
  final List<String> focusTags;
  final List<FeatureSectionData> sections;
  final String nextStep;
  final IconData heroIcon;
  final List<FeatureSnapshotData> snapshots;
  final Widget? footer;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colors = theme.colorScheme;

    return CustomScrollView(
      physics: const BouncingScrollPhysics(),
      slivers: [
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 28),
          sliver: SliverList.list(
            children: [
              _HeroCard(
                eyebrow: eyebrow,
                title: title,
                summary: summary,
                focusTags: focusTags,
                heroIcon: heroIcon,
              ),
              if (snapshots.isNotEmpty) ...[
                const SizedBox(height: 16),
                Text('Mobile emphasis', style: theme.textTheme.titleMedium),
                const SizedBox(height: 12),
                SizedBox(
                  height: 168,
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    physics: const BouncingScrollPhysics(),
                    itemBuilder: (context, index) {
                      return _SnapshotCard(snapshot: snapshots[index]);
                    },
                    separatorBuilder: (_, __) => const SizedBox(width: 12),
                    itemCount: snapshots.length,
                  ),
                ),
              ],
              const SizedBox(height: 18),
              for (final section in sections) ...[
                _SectionCard(section: section),
                const SizedBox(height: 14),
              ],
              _NextStepCard(nextStep: nextStep),
              if (footer != null) ...[
                const SizedBox(height: 14),
                footer!,
              ],
            ],
          ),
        ),
      ],
    );
  }
}

class _HeroCard extends StatelessWidget {
  const _HeroCard({
    required this.eyebrow,
    required this.title,
    required this.summary,
    required this.focusTags,
    required this.heroIcon,
  });

  final String eyebrow;
  final String title;
  final String summary;
  final List<String> focusTags;
  final IconData heroIcon;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colors = theme.colorScheme;

    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Color(0xFFFFFFFF),
            Color(0xFFF4F8FF),
            Color(0xFFEAF1FF),
          ],
        ),
        borderRadius: BorderRadius.circular(30),
        border: Border.all(color: Colors.white.withValues(alpha: 0.85)),
        boxShadow: [
          BoxShadow(
            color: colors.shadow.withValues(alpha: 0.07),
            blurRadius: 30,
            offset: const Offset(0, 14),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 50,
                height: 50,
                decoration: BoxDecoration(
                  color: colors.primaryContainer,
                  borderRadius: BorderRadius.circular(18),
                ),
                child: Icon(heroIcon, color: colors.primary),
              ),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.72),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  eyebrow.toUpperCase(),
                  style: theme.textTheme.labelMedium?.copyWith(
                    letterSpacing: 1.0,
                    color: colors.primary,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 18),
          Text(title, style: theme.textTheme.headlineMedium),
          const SizedBox(height: 12),
          Text(summary, style: theme.textTheme.bodyLarge),
          if (focusTags.isNotEmpty) ...[
            const SizedBox(height: 18),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: focusTags
                  .map(
                    (tag) => Chip(
                      label: Text(tag),
                      visualDensity: VisualDensity.compact,
                    ),
                  )
                  .toList(),
            ),
          ],
        ],
      ),
    );
  }
}

class _SnapshotCard extends StatelessWidget {
  const _SnapshotCard({
    required this.snapshot,
  });

  final FeatureSnapshotData snapshot;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colors = theme.colorScheme;

    return SizedBox(
      width: 176,
      child: Container(
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          color: colors.surface,
          borderRadius: BorderRadius.circular(26),
          border: Border.all(color: theme.dividerColor),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                color: colors.primaryContainer,
                borderRadius: BorderRadius.circular(16),
              ),
              child: Icon(snapshot.icon, color: colors.primary),
            ),
            const Spacer(),
            Text(snapshot.label, style: theme.textTheme.labelLarge),
            const SizedBox(height: 6),
            Text(
              snapshot.value,
              style: theme.textTheme.titleLarge?.copyWith(
                color: colors.primary,
              ),
            ),
            const SizedBox(height: 8),
            Text(snapshot.caption, style: theme.textTheme.bodyMedium),
          ],
        ),
      ),
    );
  }
}

class _SectionCard extends StatelessWidget {
  const _SectionCard({
    required this.section,
  });

  final FeatureSectionData section;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colors = theme.colorScheme;

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(26),
        border: Border.all(color: theme.dividerColor),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  color: colors.primaryContainer,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Icon(section.icon, color: colors.primary, size: 20),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(section.title, style: theme.textTheme.titleMedium),
              ),
            ],
          ),
          const SizedBox(height: 16),
          for (final item in section.items) ...[
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 20,
                  alignment: Alignment.topCenter,
                  padding: const EdgeInsets.only(top: 8),
                  child: Container(
                    width: 6,
                    height: 6,
                    decoration: BoxDecoration(
                      color: colors.primary,
                      shape: BoxShape.circle,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    item,
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: colors.onSurface,
                    ),
                  ),
                ),
              ],
            ),
            if (item != section.items.last) const SizedBox(height: 12),
          ],
        ],
      ),
    );
  }
}

class _NextStepCard extends StatelessWidget {
  const _NextStepCard({
    required this.nextStep,
  });

  final String nextStep;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colors = theme.colorScheme;

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Color(0xFFEDF3FF),
            Color(0xFFF5F8FF),
          ],
        ),
        borderRadius: BorderRadius.circular(26),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.72),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Icon(Icons.arrow_forward_rounded, color: colors.primary),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Next module', style: theme.textTheme.titleMedium),
                const SizedBox(height: 8),
                Text(
                  nextStep,
                  style: theme.textTheme.bodyLarge?.copyWith(
                    color: colors.onSurface,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
