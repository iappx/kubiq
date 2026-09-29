import { describe, expect, it } from 'vitest'
import { ClusterIconFile } from '@/application/services/clusterAppearance/models/ClusterIconFile'

describe('ClusterIconFile', () => {
    it('accepts PNG, JPG and SVG in any case', () => {
        expect(ClusterIconFile.isSupported('C:\\Pictures\\logo.PNG')).toBe(true)
        expect(ClusterIconFile.isSupported('/home/me/logo.jpeg')).toBe(true)
        expect(ClusterIconFile.isSupported('/home/me/logo.svg')).toBe(true)
        expect(ClusterIconFile.isSupported('/home/me/logo.gif')).toBe(false)
        expect(ClusterIconFile.isSupported('/home/me/logo')).toBe(false)
    })

    it('names the media type the browser needs to draw it', () => {
        expect(ClusterIconFile.mimeOf('logo.jpg')).toBe('image/jpeg')
        expect(ClusterIconFile.mimeOf('logo.svg')).toBe('image/svg+xml')
    })

    it('stores a copy under the user profile, named after the cluster and keeping the extension', () => {
        expect(ClusterIconFile.pathFor('arn:aws:eks:eu-west-1:1:cluster/prod', 'D:/logo.PNG', 36))
            .toBe('userdata:clusters/icons/arn-aws-eks-eu-west-1-1-cluster-prod-10.png')
    })

    it('never lets a cluster name climb out of the icons folder', () => {
        expect(ClusterIconFile.pathFor('../../etc', 'D:/logo.png', 1)).toBe('userdata:clusters/icons/etc-1.png')
    })

    it('builds a data url from the base64 content', () => {
        expect(ClusterIconFile.urlOf('logo.png', 'AAAA')).toBe('data:image/png;base64,AAAA')
    })

    it('gives the dialog one pattern for every supported extension', () => {
        expect(ClusterIconFile.pattern).toBe('*.png;*.jpg;*.jpeg;*.svg')
    })

    it('shows the file name without its folder', () => {
        expect(ClusterIconFile.nameOf('C:\\Pictures\\logo.png')).toBe('logo.png')
        expect(ClusterIconFile.nameOf('/home/me/logo.png')).toBe('logo.png')
    })
})
