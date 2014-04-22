Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',
    items:[
        {
            xtype: 'container',
            itemId: 'widgets',
        },
        {
            xtype: 'container',
            itemId:'gridContainer',
            columnWidth: 1
        }
        
        
    ],
    launch: function() {
        var that = this;
        that.tagPicker = Ext.create('Rally.ui.picker.TagPicker',{
            itemId: 'tagpicker'
        });
        
        that.down('#widgets').add(this.tagPicker);
        
        that.down('#widgets').add({
            xtype: 'rallybutton',
            id: 'getTasks',
            text: 'Get Tasks',
            handler: function(){
                that._getTasks();
            }
        })
    },
    _getTasks: function() {
        var that = this;
        var selectedTagRecords = this.tagPicker._getRecordValue();
        that._tagNames = [];
        console.log(selectedTagRecords.length);
        if (selectedTagRecords.length > 0) {
             var tagFilters = [];
             _.each(selectedTagRecords, function(thisTag) {
                var thisTagName = thisTag.get('Name');
                that._tagNames.push(thisTagName); 
                var tagFilter = {
                    property: 'Tags.Name',
                    operator: 'contains',
                    value: thisTagName
                };
                tagFilters.push(tagFilter);
            });
        }
        
        else{
            that._noTagsNotify();       
        }
        Ext.create('Rally.data.wsapi.Store', {
                model: 'Task',
                fetch: ['FormattedID', 'Name', 'State', 'WorkProduct'],
                autoLoad: true,
                context: {
                    //project: that.getContext().getProject(),
                    project: '/project/12352608219',
                    projectScopeDown: false,
                    projectScopeUp: false
                },
                listeners: {
                    load: this._onDataLoaded,
                    scope: this
                },
                filters: Rally.data.wsapi.Filter.or(tagFilters)
        });
    },
     _onDataLoaded: function(store, records) {
        var that = this;
        var promises = [];

        if (records.length === 0) {
            that._noArtifactsNotify();
        }

        _.each(records, function(artifact) {
            promises.push(that._getArtifactTags(artifact, that));
        });

        Deft.Promise.all(promises).then({
            success: function(results) {
                that._artifactsWithTags = results;
                that._makeGrid();
            }
        });
    },

    _getArtifactTags: function(artifact, scope) {

        var deferred                = Ext.create('Deft.Deferred');
        var that                      = scope;

        var tags                    = [];

        var artifactRef             = artifact.get('_ref');
        var artifactObjectID        = artifact.get('ObjectID');
        var artifactFormattedID     = artifact.get('FormattedID');
        var artifactName            = artifact.get('Name');
        var artifactState            = artifact.get('State');
        var artifactWorkProduct     = artifact.get('WorkProduct').FormattedID;
        var tagsCollection          = artifact.getCollection("Tags", {fetch: ['Name', 'ObjectID']});
        var tagCount                = tagsCollection.getCount();

        tagsCollection.load({
            callback: function(records, operation, success) {
                _.each(records, function(tag) {
                    tags.push(tag);
                });
                result = {
                    "_ref"          : artifactRef,
                    "ObjectID"      : artifactObjectID,
                    "FormattedID"   : artifactFormattedID,
                    "Name"          : artifactName,
                    "State"         : artifactState,
                    "WorkProduct"   : artifactWorkProduct,
                    "Tags"          : tags
                };
                deferred.resolve(result);
            }
        });

        return deferred;
    },

    _makeGrid: function() {
        var that = this;

        if (that._artifactTagsGrid) {
            that._artifactTagsGrid.destroy();
        }

        var gridStore = Ext.create('Rally.data.custom.Store', {
            data: that._artifactsWithTags,
            groupField: 'WorkProduct',
            pageSize: 1000,
            //remoteSort: false
        });

        that._artifactTagsGrid = Ext.create('Rally.ui.grid.Grid', {
            itemId: 'artifactGrid',
            store: gridStore,
            features: [{ftype:'grouping'}],
            columnCfgs: [
                {
                    text: 'Formatted ID', dataIndex: 'FormattedID', xtype: 'templatecolumn',
                    tpl: Ext.create('Rally.ui.renderer.template.FormattedIDTemplate')
                },
                {
                    text: 'Name', dataIndex: 'Name', flex: 1
                },
                {
                    text: 'State', dataIndex: 'State', flex: 1
                },
                {
                    text: 'WorkProduct', dataIndex: 'WorkProduct', flex: 1
                },
                {
                    text: 'Tags', dataIndex: 'Tags',
                    renderer: function(values) {
                        var tagArray = [];
                        Ext.Array.each(values, function(tag) {
                            var tagName = tag.get('Name');
                            tagArray.push(tagName);
                        });
                        return tagArray.join(', ');
                    },
                    flex: 1
                }
            ]
        });

        that.down('#gridContainer').add(that._artifactTagsGrid);
        that._artifactTagsGrid.reconfigure(gridStore);
    },


    _noArtifactsNotify: function() {
        this.down('#gridContainer').add({
            xtype: 'container',
            html: "No artifacts found matching some or all selected tags."
        });
    } 
});
